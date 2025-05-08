// src/env.d.ts

/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
type Session = import("better-auth").Session;
type BaseUser = import("better-auth").User;
type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

// Extend the User type to include additional fields
interface User extends BaseUser {
  role?: string;
}

declare namespace App {
  interface Locals extends Runtime {
    session: { Session: Session, User: User };
  }
}
