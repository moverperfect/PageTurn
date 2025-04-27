// src/env.d.ts

/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
type Session = import("better-auth").Session;
type User = import("better-auth").User;
type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    session: { Session: Session, User: User };
  }
}
