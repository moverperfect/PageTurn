#!/usr/bin/env node
/**
 * Acceptance test harness.
 *
 * Runs the full acceptance seam end to end:
 *   1. Builds the application (astro check + astro build), unless
 *      ACCEPTANCE_SKIP_BUILD=1 is set for local iteration on tests only.
 *   2. Provisions an isolated local D1 database in a temp directory and
 *      applies every migration.
 *   3. Boots the built Worker with `wrangler dev`, pointing better-auth at
 *      the local origin and enabling the credential auth seam for fixtures.
 *   4. Runs the Vitest suite in tests/acceptance against the live HTTP
 *      boundary.
 *   5. Tears the Worker down and deletes the temp database, deterministically,
 *      whatever the test outcome.
 *
 * Usage: pnpm run test:acceptance
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status === 200) {
        return;
      }
      lastError = new Error(`server responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`Server at ${url} did not become ready: ${lastError}`);
}

function signalServerGroup(child, signal) {
  // Negative PID signals the whole process group, so workerd children die too.
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

async function stopServer(child) {
  if (child.exitCode !== null) {
    return;
  }
  const exited = new Promise((resolve) => child.once("exit", resolve));
  signalServerGroup(child, "SIGTERM");
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, 10_000, "timeout");
  });
  if ((await Promise.race([exited, timeout])) === "timeout") {
    signalServerGroup(child, "SIGKILL");
    await exited;
  }
  // The losing timer would otherwise keep the event loop (and CI job) alive
  // for the rest of the 10 seconds.
  clearTimeout(timer);
}

const skipBuild = process.env.ACCEPTANCE_SKIP_BUILD === "1";
if (skipBuild) {
  console.log("[acceptance] ACCEPTANCE_SKIP_BUILD=1, reusing existing dist/");
} else {
  console.log("[acceptance] Building application (astro check + astro build)...");
  await run("pnpm", ["run", "build"]);
}

const persistDir = mkdtempSync(path.join(os.tmpdir(), "pageturn-acceptance-"));
let server;
let torndown = false;

async function teardown() {
  if (torndown) {
    return;
  }
  torndown = true;
  if (server) {
    console.log("[acceptance] Stopping worker");
    await stopServer(server);
  }
  rmSync(persistDir, { recursive: true, force: true });
  console.log("[acceptance] Cleaned up isolated database");
}

// try/finally does not run on signals; make Ctrl+C and CI cancellation clean
// up the worker process group and the temp database too.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    teardown().finally(() => process.exit(1));
  });
}

try {
  console.log(`[acceptance] Provisioning isolated D1 database in ${persistDir}`);
  await run("pnpm", [
    "exec",
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "page-turn",
    "--local",
    "--persist-to",
    persistDir,
  ], { env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });

  const port = await findFreePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const authSecret = randomBytes(32).toString("hex");

  console.log(`[acceptance] Starting worker at ${baseURL}`);
  const vars = {
    BETTER_AUTH_URL: baseURL,
    AUTH_TRUSTED_ORIGINS: baseURL,
    ACCEPTANCE_TEST_AUTH: "true",
    BETTER_AUTH_SECRET: authSecret,
    // getAuth() requires OAuth credentials to exist; the suite never follows
    // a social login, so placeholder values are enough.
    GITHUB_CLIENT_ID: "acceptance-placeholder",
    GITHUB_CLIENT_SECRET: "acceptance-placeholder",
    GOOGLE_CLIENT_ID: "acceptance-placeholder",
    GOOGLE_CLIENT_SECRET: "acceptance-placeholder",
  };
  const varArgs = Object.entries(vars).flatMap(([key, value]) => ["--var", `${key}:${value}`]);
  server = spawn(
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--persist-to",
      persistDir,
      ...varArgs,
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
      detached: true,
      env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
    }
  );
  server.on("error", (error) => {
    console.error("[acceptance] Failed to start wrangler dev:", error);
  });

  await waitForReady(`${baseURL}/login`, 90_000);
  console.log("[acceptance] Worker is ready, running acceptance suite");

  await run("pnpm", ["exec", "vitest", "run", "--project", "acceptance"], {
    env: {
      ...process.env,
      ACCEPTANCE_BASE_URL: baseURL,
      ACCEPTANCE_PERSIST_DIR: persistDir,
    },
  });
  console.log("[acceptance] Acceptance suite passed");
} finally {
  await teardown();
}
