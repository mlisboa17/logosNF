"use client";

import { useState } from "react";

export type AuditLogEntryItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  metadata?: any;
};

type Props = {
  entries: AuditLogEntryItem[];
};

export function AuditLogsTable({ entries }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleExportCsv() {
    setDownloading(true);
    try {
      const res = await fetch("/api/audit/export");
      if (!res.ok) {
        throw new Error("Falha ao exportar relatório de auditoria.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio-auditoria-seguranca.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro no download.");
    } finally {
      setDownloading(false);
    }
  }

  function getActionBadge(action: string) {
    if (action.includes("MANIFESTATION")) return "bg-blue-100 text-blue-800";
    if (action.includes("SYNC")) return "bg-teal-100 text-teal-800";
    if (action.includes("DETAILS")) return "bg-slate-100 text-slate-700";
    if (action.includes("MEMBER")) return "bg-purple-100 text-purple-800";
    if (action.includes("LOCKOUT")) return "bg-red-100 text-red-800";
    return "bg-slate-100 text-slate-800";
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Trilha de Auditoria & Governança (LGPD)</h3>
          <p className="text-xs text-slate-500">Histórico de ações de operadores, consultas e manifestações transmitidas.</p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={downloading || !entries.length}
          className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
        >
          {downloading ? "Exportando..." : "Exportar Logs (CSV)"}
        </button>
      </div>

      {!entries.length ? (
        <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
          Nenhum registro de auditoria encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase text-[10px] text-slate-500">
              <tr>
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Usuário</th>
                <th className="p-3">Ação Realizada</th>
                <th className="p-3">Entidade Alvo</th>
                <th className="p-3">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-500">{new Date(entry.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="p-3">
                    <span className="font-bold text-slate-900 block">{entry.userName}</span>
                    <span className="text-[10px] text-slate-400">{entry.userEmail}</span>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-0.5 font-bold text-[10px] ${getActionBadge(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 font-mono text-[11px]">
                    {entry.entityType} ({entry.entityId?.slice(0, 8) || "—"})
                  </td>
                  <td className="p-3 font-mono text-[10px] text-slate-500 max-w-[200px] truncate" title={JSON.stringify(entry.metadata)}>
                    {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
