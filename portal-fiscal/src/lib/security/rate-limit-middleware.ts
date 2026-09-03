import "server-only";
import { headers } from "next/headers";
import { checkRateLimit } from "./rate-limit";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

const RATE_LIMIT_PRESETS = {
  AUTH: { windowMs: 15 * 60 * 1000, max: 5, keyPrefix: "auth" }, // 5 tentativas em 15min
  API: { windowMs: 60 * 1000, max: 60, keyPrefix: "api" }, // 60 por minuto
  SYNC: { windowMs: 60 * 1000, max: 10, keyPrefix: "sync" }, // 10 sincronizações por minuto
  EXPORT: { windowMs: 3600 * 1000, max: 20, keyPrefix: "export" }, // 20 por hora
  WEBHOOK: { windowMs: 60 * 1000, max: 100, keyPrefix: "webhook" }, // 100 por minuto
} as const;

export async function getRateLimitIdentifier(): Promise<string> {
  const headersList = await headers();
  return headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
}

export async function checkApiRateLimit(
  preset: keyof typeof RATE_LIMIT_PRESETS,
  customIdentifier?: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const config = RATE_LIMIT_PRESETS[preset];
  const identifier = customIdentifier || (await getRateLimitIdentifier());
  return checkRateLimit(identifier, config);
}

export function createRateLimitHeaders(result: Awaited<ReturnType<typeof checkApiRateLimit>>) {
  return {
    "X-RateLimit-Limit": "60",
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export class RateLimitError extends Error {
  constructor(public resetAt: number) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}
