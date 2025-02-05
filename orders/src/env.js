import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    ALPACA_LIVE_KEY: z.string(),
    ALPACA_LIVE_SECRET: z.string(),
    ALPACA_PAPER_KEY: z.string(),
    ALPACA_PAPER_SECRET: z.string(),
    ALPACA_TRADINGVIEW_SYMBOLS: z.string(),
    ALPACA_TRADINGVIEW_INVERSE_PAIRS: z.string(),
    POSTGRES_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DEVELOPMENT_MODE: z.string(),
    FINANCIAL_YEAR_PERIOD: z.string(),
    QSTASH_TOKEN: z.string(),
    QSTASH_URL: z.string(),
    QSTASH_NEXT_SIGNING_KEY: z.string(),
    QSTASH_CURRENT_SIGNING_KEY: z.string(),
    SENTRY_AUTH_TOKEN: z.string(),
    TRADINGVIEW_AUTH_TOKEN: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    ALPACA_LIVE_KEY: process.env.ALPACA_LIVE_KEY,
    ALPACA_LIVE_SECRET: process.env.ALPACA_LIVE_SECRET,
    ALPACA_PAPER_KEY: process.env.ALPACA_PAPER_KEY,
    ALPACA_PAPER_SECRET: process.env.ALPACA_PAPER_SECRET,
    ALPACA_TRADINGVIEW_SYMBOLS: process.env.ALPACA_TRADINGVIEW_SYMBOLS,
    ALPACA_TRADINGVIEW_INVERSE_PAIRS:
      process.env.ALPACA_TRADINGVIEW_INVERSE_PAIRS,
    POSTGRES_URL: process.env.POSTGRES_URL,
    NODE_ENV: process.env.NODE_ENV,
    DEVELOPMENT_MODE: process.env.DEVELOPMENT_MODE,
    FINANCIAL_YEAR_PERIOD: process.env.FINANCIAL_YEAR_PERIOD,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_URL: process.env.QSTASH_URL,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    TRADINGVIEW_AUTH_TOKEN: process.env.TRADINGVIEW_AUTH_TOKEN,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
