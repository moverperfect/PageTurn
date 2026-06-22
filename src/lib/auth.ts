import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { getDbClient } from "./db-client";
import { verification } from "./schema";
import { admin, oAuthProxy, oneTap } from "better-auth/plugins";

// Singleton auth client
const authInstances = new Map<string, ReturnType<typeof betterAuth>>();

function splitOrigins(origins?: string) {
  return origins
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
}

function hostMatchesSuffix(host: string, suffix?: string) {
  if (!suffix) return false;

  const normalizedSuffix =
    suffix.startsWith(".") || suffix.startsWith("-") ? suffix : `.${suffix}`;
  const bareSuffix = normalizedSuffix.startsWith(".")
    ? normalizedSuffix.slice(1)
    : normalizedSuffix;
  return host === bareSuffix || host.endsWith(normalizedSuffix);
}

function parseTrustedOrigin(origin: string) {
  try {
    return new URL(origin).origin;
  } catch {
    console.warn(`Invalid origin in AUTH_TRUSTED_ORIGINS: ${origin}`);
    return null;
  }
}

function matchesOriginPattern(origin: string, pattern: string) {
  try {
    const originUrl = new URL(origin);
    const patternUrl = new URL(pattern);

    if (originUrl.protocol !== patternUrl.protocol) {
      return false;
    }

    if (originUrl.port !== patternUrl.port) {
      return false;
    }

    const originHost = originUrl.hostname.toLowerCase();
    const patternHost = patternUrl.hostname.toLowerCase();

    if (patternHost.startsWith("*.")) {
      const suffix = patternHost.slice(2);
      return originHost !== suffix && originHost.endsWith(`.${suffix}`);
    }

    return originUrl.origin === patternUrl.origin;
  } catch {
    return false;
  }
}

/**
 * Returns the origin (protocol + host) of the base authentication URL for the application.
 * 
 * @param {Env} env - The Cloudflare environment bindings containing authentication config.
 * @returns {string} The origin (e.g., "https://pageturn.moverperfect.com") of the configured BETTER_AUTH_URL.
 */
function getBaseAuthOrigin(env: Env): string {
  return new URL(env.BETTER_AUTH_URL).origin;
}

/**
 * Extracts the origin (protocol + host) from a given Request object.
 *
 * @param {Request} [request] - The Request object from which to extract the origin.
 * @returns {string | null} The origin string (e.g., "https://example.com") if available, otherwise null.
 */
function getRequestOrigin(request?: Request): string | null {
  if (!request) {
    return null;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

function getRequestURL(request?: Request): URL | null {
  if (!request) {
    return null;
  }

  try {
    return new URL(request.url);
  } catch {
    return null;
  }
}

/**
 * Determines if the given origin matches the production authentication origin configured in the environment.
 *
 * @param {Env} env - The Cloudflare environment bindings containing authentication config.
 * @param {string} origin - The origin (protocol + host) to check (e.g., "https://pageturn.moverperfect.com").
 * @returns {boolean} True if the origin matches the configured base authentication origin, otherwise false.
 */
function isProductionOrigin(env: Env, origin: string): boolean {
  return origin === getBaseAuthOrigin(env);
}

/**
 * Determines if the given origin matches the Cloudflare Workers Preview host suffix as configured
 * in the environment, and uses the HTTPS protocol.
 *
 * @param {Env} env - The Cloudflare environment bindings containing configuration, including WORKERS_PREVIEW_HOST_SUFFIX.
 * @param {string} origin - The origin URL (protocol + host) to check (e.g., "https://example-pageturn.moverperfect.workers.dev").
 * @returns {boolean} True if the origin is a valid Workers Preview host with HTTPS, otherwise false.
 */
function isWorkersPreviewOrigin(env: Env, origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      hostMatchesSuffix(url.hostname, env.WORKERS_PREVIEW_HOST_SUFFIX)
    );
  } catch {
    return false;
  }
}

/**
 * Determines the appropriate base URL to use for authentication callbacks and redirects,
 * based on the current environment and incoming request.
 *
 * - If the request's origin matches the production origin or a valid Workers Preview origin,
 *   returns the request's origin (protocol + host).
 * - Otherwise, falls back to the configured base authentication origin from the environment.
 *
 * @param {Env} env - The Cloudflare environment bindings containing authentication config.
 * @param {Request} [request] - Optional Request object to extract the origin from.
 * @returns {string} The origin URL (protocol + host) to use as the authentication base URL.
 */
function getAuthBaseURL(
  env: Env,
  request?: Request,
  baseURLOverride?: string | null
): string {
  if (baseURLOverride && isWorkersPreviewOrigin(env, baseURLOverride)) {
    return new URL(baseURLOverride).origin;
  }

  const requestOrigin = getRequestOrigin(request);

  if (
    requestOrigin &&
    (isProductionOrigin(env, requestOrigin) ||
      isWorkersPreviewOrigin(env, requestOrigin))
  ) {
    return requestOrigin;
  }

  return getBaseAuthOrigin(env);
}

function isProductionOAuthCallbackRequest(env: Env, request: Request): boolean {
  const requestUrl = getRequestURL(request);

  return (
    !!requestUrl &&
    isProductionOrigin(env, requestUrl.origin) &&
    requestUrl.pathname.startsWith("/api/auth/callback/")
  );
}

function getTrustedPreviewProxyOrigin(env: Env, callbackURL: unknown) {
  if (typeof callbackURL !== "string") {
    return null;
  }

  try {
    const url = new URL(callbackURL);
    if (
      url.pathname !== "/api/auth/oauth-proxy-callback" ||
      !isWorkersPreviewOrigin(env, url.origin)
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export async function getOAuthProxyBaseURL(env: Env, request: Request) {
  if (!isProductionOAuthCallbackRequest(env, request)) {
    return null;
  }

  const state = getRequestURL(request)?.searchParams.get("state");
  if (!state) {
    return null;
  }

  const [stateRecord] = await getDbClient(env)
    .select()
    .from(verification)
    .where(eq(verification.identifier, state))
    .limit(1);

  if (!stateRecord) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(stateRecord.value) as { callbackURL?: unknown };
    return getTrustedPreviewProxyOrigin(env, parsedValue.callbackURL);
  } catch {
    return null;
  }
}

export function isTrustedAuthOrigin(env: Env, origin: string | null) {
  if (!origin) {
    return false;
  }

  try {
    const isProduction = isProductionOrigin(env, new URL(origin).origin);
    const isWorkersPreview = isWorkersPreviewOrigin(env, origin);
    const isConfiguredTrustedOrigin = splitOrigins(env.AUTH_TRUSTED_ORIGINS).some(
      (pattern) => matchesOriginPattern(origin, pattern)
    );

    return isProduction || isWorkersPreview || isConfiguredTrustedOrigin;
  } catch {
    return false;
  }
}

// Static auth config for CLI generation
// The CLI only needs the configuration, not an actual initialized instance
export const auth = betterAuth({
  secret: process.env.OAUTH_PROXY_SECRET || process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter({} as any, {
    // The CLI doesn't execute this function, it just reads the config structure
    // so we can provide a placeholder that will be replaced at runtime
    provider: "sqlite",
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [
    admin({
      adminRoles: ["admin"],
      defaultRole: "user",
      impersonationSessionDuration: 60 * 60,
      defaultBanReason: "Banned by administrator",
      bannedUserMessage: "Your account has been suspended. Please contact support if you believe this is an error."
    }),
    oAuthProxy({
      currentURL: process.env.AUTH_PREVIEW_URL || process.env.BETTER_AUTH_URL,
      productionURL: process.env.BETTER_AUTH_URL,
    })
  ]
});

/**
 * Returns a singleton authentication client configured with OAuth providers and plugins based on the given environment.
 *
 * Initializes the authentication client with a Drizzle adapter, GitHub and Google OAuth credentials, redirect URIs, and the oAuthProxy and oneTap plugins using environment variables. Ensures only one instance is created per process.
 *
 * @param env - Environment object containing OAuth credentials, database configuration, and URLs for authentication.
 * @param request - Optional request used to derive the auth base URL for preview deployments.
 * @returns The initialized authentication client instance.
 *
 * @throws {Error} If GitHub or Google OAuth credentials are missing from {@link env}.
 */
export function getAuth(env: Env, request?: Request, baseURLOverride?: string | null) {
  const baseURL = getAuthBaseURL(env, request, baseURLOverride);
  const instanceKey = baseURL;

  if (!authInstances.has(instanceKey)) {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new Error('Missing GitHub OAuth credentials in environment variables');
    }
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Missing Google OAuth credentials in environment variables');
    }
    const baseUrlHost = new URL(env.BETTER_AUTH_URL).hostname;
    const shouldUseCrossSubDomainCookies = isProductionOrigin(env, baseURL);
    const cookieDomain =
      !shouldUseCrossSubDomainCookies ||
        baseUrlHost.startsWith("localhost") ||
        baseUrlHost.includes("127.0.0.1")
        ? undefined
        : `.${baseUrlHost}`;

    authInstances.set(instanceKey, betterAuth({
      secret: env.OAUTH_PROXY_SECRET || env.BETTER_AUTH_SECRET,
      baseURL,
      trustedOrigins: (request) => {
        const origins = [env.BETTER_AUTH_URL];
        const requestOrigin = request.headers.get("Origin");
        if (isTrustedAuthOrigin(env, requestOrigin)) {
          origins.push(requestOrigin!);
        }
        for (const origin of splitOrigins(env.AUTH_TRUSTED_ORIGINS)) {
          const trustedOrigin = parseTrustedOrigin(origin);
          if (trustedOrigin && !trustedOrigin.includes("*")) {
            origins.push(trustedOrigin);
          }
        }
        return origins;
      },
      ...(cookieDomain
        ? {
          advanced: {
            crossSubDomainCookies: {
              enabled: true,
              domain: cookieDomain,
            },
          },
        }
        : {}),
      database: drizzleAdapter(getDbClient(env), {
        provider: "sqlite",
      }),
      socialProviders: {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/github`
        },
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/google`
        }
      },
      plugins: [
        oAuthProxy({
          productionURL: env.BETTER_AUTH_URL,
        }),
        oneTap(),
        admin({
          adminRoles: ["admin"],
          defaultRole: "user",
          impersonationSessionDuration: 60 * 60,
          defaultBanReason: "Banned by administrator",
          bannedUserMessage: "Your account has been suspended. Please contact support if you believe this is an error."
        })
      ]
    }));
  }
  return authInstances.get(instanceKey)!;
}
