"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { DocumentDetailModal } from "./DocumentDetailModal";
import { ManifestationModal } from "./ManifestationModal";

type ManifestationStatus = "NOT_APPLICABLE" | "PENDING" | "SCIENCE" | "CONFIRMED" | "UNKNOWN_OPERATION" | "NOT_PERFORMED";

export type DocumentRow = {
  id: string;
  kind: "NFSE" | "NFSE_EVENT" | "NFE" | "NFE_EVENT";
  accessKey: string | null;
  nsu: string;
  issuedAt: string | null;
  companyName: string;
  manifestationStatus: ManifestationStatus;
  lastDownloadedAt: string | null;
  isSummary?: boolean;
};

const fieldClass = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-hidden transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10";
const statusStyle = {
  NOT_APPLICABLE: { label: "Não se aplica", row: "", badge: "bg-slate-100 text-slate-600" },
  PENDING: { label: "Pendente", row: "bg-slate-50/70", badge: "bg-slate-100 text-slate-700" },
  SCIENCE: { label: "Ciência", row: "bg-blue-50/50", badge: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "Confirmada", row: "bg-emerald-50/50", badge: "bg-emerald-100 text-emerald-700" },
  UNKNOWN_OPERATION: { label: "Desconhecida", row: "bg-red-50/50", badge: "bg-red-100 text-red-700" },
  NOT_PERFORMED: { label: "Não realizada", row: "bg-amber-50/60", badge: "bg-amber-100 text-amber-800" },
} as const;

export function DocumentsTable({ documents, pendingSince }: { documents: DocumentRow[]; pendingSince: string }) {
  const [detailDocumentId, setDetailDocumentId] = useState<string | null>(null);
  const [manifestingDocument, setManifestingDocument] = useState<{ id: string; accessKey: string | null } | null>(null);
  const [isBatchManifesting, setIsBatchManifesting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [format, setFormat] = useState("complete_zip");
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("all");
  const [kind, setKind] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [view, setView] = useState(() => documents.some((item) => item.kind === "NFE") ? "pending7" : "all");
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");

  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("pt-BR"));
  const companies = useMemo(() => [...new Set(documents.map((item) => item.companyName))].sort((a, b) => a.localeCompare(b, "pt-BR")), [documents]);

  const filteredDocuments = useMemo(() => documents.filter((item) => {
    if (view === "pending7" && !(item.kind === "NFE" && item.manifestationStatus === "PENDING" && Boolean(item.issuedAt && item.issuedAt >= pendingSince))) return false;
    if (view === "nfse" && item.kind !== "NFSE") return false;
    if (view === "nfe" && item.kind !== "NFE") return false;
    if (view === "event" && !item.kind.endsWith("EVENT")) return false;

    if (company !== "all" && item.companyName !== company) return false;
    if (kind === "nfse" && item.kind !== "NFSE") return false;
    if (kind === "nfe" && item.kind !== "NFE") return false;
    if (kind === "event" && !item.kind.endsWith("EVENT")) return false;

    const itemDate = item.issuedAt?.slice(0, 10) ?? "";
    if (dateFrom && (!itemDate || itemDate < dateFrom)) return false;
    if (dateTo && (!itemDate || itemDate > dateTo)) return false;
    if (deferredQuery && !`${item.accessKey ?? ""} ${item.nsu} ${item.companyName}`.toLocaleLowerCase("pt-BR").includes(deferredQuery)) return false;
    return true;
  }), [documents, view, pendingSince, company, kind, dateFrom, dateTo, deferredQuery]);

  const allSelected = filteredDocuments.length > 0 && filteredDocuments.every((item) => selected.has(item.id));
  const hasFilters = Boolean(query || company !== "all" || kind !== "all" || dateFrom || dateTo || view !== "all");

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      for (const item of filteredDocuments) if (allSelected) next.delete(item.id); else next.add(item.id);
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setCompany("all");
    setKind("all");
    setDateFrom("");
    setDateTo("");
    setView("all");
  }

  async function downloadSelection() {
    setDownloading(true);
    setMessage("");
    try {
      const response = await fetch("/api/documents/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], format }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Falha ao exportar." }));
        throw new Error(error.error || "Falha ao exportar.");
      }
      const blob = await response.blob();
      const name = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "documentos-fiscais.zip";
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage("Download preparado com sucesso. Atualize a lista para visualizar o selo Baixada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao exportar.");
    } finally {
      setDownloading(false);
    }
  }

  async function downloadCsvSelection() {
    setDownloading(true);
    setMessage("");
    try {
      const response = await fetch("/api/documents/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Falha ao exportar CSV." }));
        throw new Error(error.error || "Falha ao exportar CSV.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = "relatorio-documentos-fiscais.csv";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage("Planilha CSV baixada com sucesso!");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao exportar CSV.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap rounded-xl bg-slate-100 p-1 gap-1">
          <button
            type="button"
            onClick={() => setView("pending7")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${view === "pending7" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            Pendentes (7d)
          </button>
          <button
            type="button"
            onClick={() => setView("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${view === "all" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            Todos os documentos
          </button>
          <button
            type="button"
            onClick={() => setView("nfse")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${view === "nfse" ? "bg-teal-700 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            NFS-e (Serviços)
          </button>
          <button
            type="button"
            onClick={() => setView("nfe")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${view === "nfe" ? "bg-blue-700 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            NF-e (Mercadorias)
          </button>
          <button
            type="button"
            onClick={() => setView("event")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${view === "event" ? "bg-violet-700 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            Eventos
          </button>
        </div>

        <details className="relative">
          <summary className="cursor-pointer list-none rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Legenda de cores</summary>
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Situação da NF-e</p>
            <div className="mt-3 grid gap-2">
              {Object.entries(statusStyle).filter(([key]) => key !== "NOT_APPLICABLE").map(([key, style]) => (
                <div key={key} className="flex items-center gap-3 text-xs">
                  <span className={`size-3 rounded-full ${style.badge.split(" ")[0]}`} />
                  <span>{style.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 text-xs">
                <span className="size-3 rounded-full bg-amber-400" />
                <span>Somente Resumo</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="size-3 rounded-full bg-emerald-500" />
                <span>XML Completo</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="size-3 rounded-full bg-violet-500" />
                <span>Arquivo já baixado</span>
              </div>
            </div>
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">Cor e texto aparecem juntos para manter a acessibilidade.</p>
          </div>
        </details>
      </div>

      <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-5 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.7fr)_minmax(160px,1fr)_150px_150px_150px]">
          <input aria-label="Pesquisar notas" value={query} onChange={(event) => setQuery(event.target.value)} className={fieldClass} placeholder="Pesquisar chave, NSU ou empresa" />
          <select aria-label="Filtrar por empresa" value={company} onChange={(event) => setCompany(event.target.value)} className={fieldClass}>
            <option value="all">Todas as empresas</option>
            {companies.map((name) => <option key={name}>{name}</option>)}
          </select>
          <select aria-label="Filtrar por tipo" value={kind} onChange={(event) => setKind(event.target.value)} className={fieldClass}>
            <option value="all">Todos os tipos</option>
            <option value="nfe">Somente NF-e</option>
            <option value="nfse">Somente NFS-e</option>
            <option value="event">Somente eventos</option>
          </select>
          <input aria-label="Data inicial" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={fieldClass} />
          <input aria-label="Data final" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={fieldClass} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <b>{filteredDocuments.length} resultado(s)</b>
            <span className="text-slate-400">{selected.size} selecionado(s)</span>
            {hasFilters ? <button type="button" onClick={clearFilters} className="font-semibold text-teal-700 cursor-pointer">Limpar filtros</button> : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!selected.size || downloading}
              onClick={() => setIsBatchManifesting(true)}
              className="h-10 rounded-xl border border-blue-300 bg-blue-50 px-3.5 text-xs font-bold text-blue-900 hover:bg-blue-100 cursor-pointer disabled:opacity-50"
            >
              Manifestar em Lote ({selected.size})
            </button>
            <button
              type="button"
              disabled={!selected.size || downloading}
              onClick={downloadCsvSelection}
              className="h-10 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
            >
              Exportar CSV
            </button>
            <select aria-label="Formato do download" value={format} onChange={(event) => setFormat(event.target.value)} className={fieldClass}>
              <option value="complete_zip">XML + PDF em ZIP</option>
              <option value="xml_zip">Somente XML</option>
              <option value="pdf_zip">Somente PDF</option>
              <option value="merged_pdf">PDF único agrupado</option>
            </select>
            <button type="button" disabled={!selected.size || downloading} onClick={downloadSelection} className="h-10 rounded-xl bg-teal-700 px-4 text-xs font-semibold text-white cursor-pointer disabled:opacity-50">
              {downloading ? "Preparando..." : "Baixar selecionados"}
            </button>
          </div>
        </div>
        {message ? <p role="status" className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800">{message}</p> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-slate-50 uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 px-6 py-3"><input aria-label="Selecionar resultados filtrados" type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-6 py-3">Empresa</th>
              <th className="px-6 py-3">Chave / NSU</th>
              <th className="px-6 py-3">Situação</th>
              <th className="px-6 py-3">Recebimento</th>
              <th className="px-6 py-3 text-right">Downloads</th>
            </tr>
          </thead>
          <tbody>
            {!filteredDocuments.length ? (
              <tr>
                <td colSpan={7} className="px-6 py-14 text-center">
                  <p className="font-semibold text-slate-700">Nenhuma nota encontrada nesta visão</p>
                  <p className="mt-1 text-slate-400">Use “Todos os documentos” para consultar o histórico completo.</p>
                </td>
              </tr>
            ) : null}
            {filteredDocuments.map((item) => {
              const status = statusStyle[item.manifestationStatus];
              return (
                <tr key={item.id} className={`border-t border-slate-100 ${status.row} ${selected.has(item.id) ? "ring-1 ring-inset ring-teal-300" : ""}`}>
                  <td className="px-6 py-4"><input aria-label={`Selecionar ${item.accessKey || item.nsu}`} type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} /></td>
                  <td className="px-3 py-4">
                    <span className={`rounded-lg px-2.5 py-1 font-bold ${item.kind.endsWith("EVENT") ? "bg-violet-100 text-violet-700" : item.kind === "NFE" ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700"}`}>
                      {item.kind.endsWith("EVENT") ? "Evento" : item.kind === "NFE" ? "NF-e" : "NFS-e"}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">{item.companyName}</td>
                  <td className="max-w-[250px] truncate px-6 py-4 font-mono text-slate-500">{item.accessKey || `NSU ${item.nsu}`}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2.5 py-1 font-bold ${status.badge}`}>{status.label}</span>
                      {item.kind === "NFE" && item.isSummary ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-800" title="Resumo capturado via SEFAZ. Aguardando XML completo pós-manifestação.">Somente Resumo</span>
                      ) : item.kind === "NFE" && item.isSummary === false ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800">XML Completo</span>
                      ) : null}
                      {item.lastDownloadedAt ? (
                        <span title={`Último download: ${new Date(item.lastDownloadedAt).toLocaleString("pt-BR")}`} className="rounded-full bg-violet-100 px-2.5 py-1 font-bold text-violet-700">Baixada</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{item.issuedAt ? new Date(item.issuedAt).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {item.kind === "NFE" ? (
                        <button
                          type="button"
                          onClick={() => setManifestingDocument({ id: item.id, accessKey: item.accessKey })}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-bold text-blue-800 hover:bg-blue-100 cursor-pointer"
                        >
                          Manifestar
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setDetailDocumentId(item.id)}
                        className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 font-bold text-teal-800 hover:bg-teal-100 cursor-pointer"
                      >
                        Detalhes
                      </button>
                      <a href={`/api/documents/${item.id}/xml`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold hover:bg-slate-50">XML</a>
                      {item.kind === "NFSE" ? (
                        <a href={`/api/documents/${item.id}/pdf`} className="rounded-lg bg-teal-700 px-3 py-1.5 font-bold text-white hover:bg-teal-800">PDF</a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DocumentDetailModal documentId={detailDocumentId} onClose={() => setDetailDocumentId(null)} />

      {manifestingDocument && (
        <ManifestationModal
          documentId={manifestingDocument.id}
          accessKey={manifestingDocument.accessKey}
          onClose={() => setManifestingDocument(null)}
        />
      )}

      {isBatchManifesting && (
        <ManifestationModal
          documentId={null}
          documentIds={[...selected]}
          onClose={() => setIsBatchManifesting(false)}
        />
      )}
    </>
  );
}
