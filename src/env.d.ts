/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    user?: {
      id: string;
      email: string;
      name: string;
      role: "member" | "admin";
    } | null;
  }
}

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  STORAGE: R2Bucket;
  SITE_URL: string;
  FROM_EMAIL: string;
  FROM_NAME: string;
  /** Set via `wrangler secret put RESEND_API_KEY`. Optional in dev. */
  RESEND_API_KEY?: string;
  /** Set via `wrangler secret put SESSION_SECRET`. Required in prod. */
  SESSION_SECRET?: string;
}
