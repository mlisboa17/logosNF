import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { syncCompanyNfseById } from "@/lib/fiscal/sync-nfse";
import { checkApiRateLimit, createRateLimitHeaders } from "@/lib/security/rate-limit-middleware";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const received = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });

  // Rate limiting para evitar sincronizações repetidas excessivas
  const authHeader = request.headers.get("authorization") || "anonymous";
  const rateLimit = await checkApiRateLimit("SYNC", authHeader);

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Limite de sincronizações atingido. Máximo de 10 por minuto." },
      {
        status: 429,
        headers: createRateLimitHeaders(rateLimit)
      }
    );
  }

  const companies = await db.company.findMany({ where: { status: "READY", certificate: { isNot: null } }, select: { id: true, legalName: true } });
  const results = [];
  for (const company of companies) {
    const result = await syncCompanyNfseById(company.id);
    results.push({ company: company.legalName, ...result });
  }

  return Response.json(
    { ok: results.every((result) => result.status !== "FAILED"), executedAt: new Date().toISOString(), results },
    { headers: createRateLimitHeaders(rateLimit) }
  );
}
