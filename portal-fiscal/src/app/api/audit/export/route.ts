import { db } from "@/lib/db";
import { organizationIds, authSession } from "@/lib/auth/session";

export const runtime = "nodejs";

function formatCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(typeof val === "object" ? JSON.stringify(val) : val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(request: Request) {
  const session = await authSession.requireApiSession();
  if (!session) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const allowedOrgs = organizationIds(session);
  const isAdmin = session.user.memberships.some(
    (m) => allowedOrgs.includes(m.organizationId) && (m.role === "OWNER" || m.role === "ADMIN")
  );

  if (!isAdmin) {
    return Response.json({ error: "Apenas administradores podem exportar logs de auditoria." }, { status: 403 });
  }

  const entries = await db.auditEntry.findMany({
    where: {
      organizationId: { in: allowedOrgs },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  let csv = "\uFEFF";
  csv += "Data/Hora;Usuario;Email;Acao;Tipo Entidade;ID Entidade;ID Organizacao;Metadados\n";

  for (const entry of entries) {
    const row = [
      formatCsvValue(entry.createdAt.toISOString()),
      formatCsvValue(entry.user?.name || "Sistema / Conector"),
      formatCsvValue(entry.user?.email || "—"),
      formatCsvValue(entry.action),
      formatCsvValue(entry.entityType),
      formatCsvValue(entry.entityId || "—"),
      formatCsvValue(entry.organizationId),
      formatCsvValue(entry.metadata ? JSON.stringify(entry.metadata) : "—"),
    ].join(";");

    csv += row + "\n";
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-auditoria-seguranca.csv"`,
    },
  });
}
