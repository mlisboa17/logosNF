import "server-only";
import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          singleLine: false,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      })
    : undefined
);

/**
 * Logger especializado para operações de segurança/auditoria
 */
export const auditLogger = logger.child({ module: "audit" });

/**
 * Logger especializado para operações fiscais (ADN/SEFAZ)
 */
export const fiscalLogger = logger.child({ module: "fiscal" });

/**
 * Logger especializado para operações de certificado
 */
export const certificateLogger = logger.child({ module: "certificate" });

/**
 * Logger especializado para API
 */
export const apiLogger = logger.child({ module: "api" });

/**
 * Log com contexto de request
 */
export function logWithContext(
  baseLogger: ReturnType<typeof logger.child>,
  context: Record<string, any>
) {
  return baseLogger.child(context);
}

/**
 * Exemplo de uso:
 *
 * import { auditLogger, fiscalLogger } from "@/lib/logging";
 *
 * // Audit log
 * auditLogger.info({ userId: "123", action: "LOGIN" }, "User logged in");
 *
 * // Fiscal log
 * fiscalLogger.info({ companyId: "456", source: "ADN_NFSE" }, "Sync started");
 *
 * // Error log
 * auditLogger.error({ error: new Error("..."), userId: "789" }, "Sync failed");
 */
