"use client";

import { useState } from "react";
import { manifestDocument, manifestDocumentsBatch } from "@/app/actions";
import type { ManifestationType } from "@/lib/fiscal/sefaz/manifestation";

type Props = {
  documentId: string | null;
  documentIds?: string[];
  accessKey?: string | null;
  onClose: () => void;
};

export function ManifestationModal({ documentId, documentIds, accessKey, onClose }: Props) {
  const [eventType, setEventType] = useState<ManifestationType>("SCIENCE");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; protocol?: string } | null>(null);

  const isBatch = Boolean(documentIds && documentIds.length > 0);
  const targetCount = isBatch ? documentIds!.length : 1;

  if (!documentId && !isBatch) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      if (isBatch) {
        const formData = new FormData();
        formData.append("documentIds", documentIds!.join(","));
        formData.append("eventType", eventType);
        const res = await manifestDocumentsBatch(formData);
        setResult({
          ok: res.ok,
          message: res.ok
            ? `Manifestação em lote concluída com sucesso para ${res.successCount} de ${res.processed} documento(s).`
            : `Erros durante o envio em lote: ${res.errors.join("; ")}`,
        });
      } else {
        const formData = new FormData();
        formData.append("documentId", documentId!);
        formData.append("eventType", eventType);
        formData.append("justification", justification);
        const res = await manifestDocument(formData);
        setResult({
          ok: res.ok,
          message: res.message,
          protocol: res.protocol,
        });
      }
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Falha na transmissão da manifestação.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header do Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isBatch ? `Manifestação em Lote (${targetCount} notas)` : "Manifestação do Destinatário (SEFAZ)"}
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              {isBatch ? `${targetCount} documentos selecionados` : `Chave: ${accessKey || documentId}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Alerta de Impacto Juridico */}
        <div className="bg-amber-50/80 border-b border-amber-100 px-6 py-3 text-xs text-amber-900 flex items-start gap-2.5">
          <svg className="size-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="font-bold block">Aviso de Responsabilidade Fiscal</span>
            <span>A manifestação transmite um evento assinado digitalmente para a SEFAZ com efeito jurídico perante o Fisco.</span>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-800 mb-2">Selecione o Evento de Manifestação:</label>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                {
                  id: "SCIENCE",
                  label: "Ciência da Operação (210210)",
                  desc: "Declara ciência da nota e solicita o XML completo da SEFAZ.",
                  color: "border-blue-200 bg-blue-50/40 text-blue-900",
                },
                {
                  id: "CONFIRMED",
                  label: "Confirmação da Operação (210200)",
                  desc: "Atesta que as mercadorias foram efetivamente recebidas.",
                  color: "border-emerald-200 bg-emerald-50/40 text-emerald-900",
                },
                {
                  id: "UNKNOWN",
                  label: "Desconhecimento da Operação (210220)",
                  desc: "Declara não reconhecer a emissão desta NF-e (proteção contra fraudes).",
                  color: "border-purple-200 bg-purple-50/40 text-purple-900",
                },
                {
                  id: "NOT_PERFORMED",
                  label: "Operação não Realizada (210240)",
                  desc: "Informa que a operação foi cancelada/recusada. Exige justificativa.",
                  color: "border-amber-200 bg-amber-50/40 text-amber-900",
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                    eventType === opt.id ? opt.color + " font-semibold ring-2 ring-teal-600/20" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="eventType"
                    value={opt.id}
                    checked={eventType === opt.id}
                    onChange={() => setEventType(opt.id as any)}
                    className="mt-0.5 text-teal-600"
                  />
                  <div>
                    <div className="font-bold text-slate-900">{opt.label}</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Campo de Justificativa para Operacao Nao Realizada */}
          {eventType === "NOT_PERFORMED" && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between items-center">
                <label className="font-bold text-slate-800">Justificativa da Recusa (obrigatória):</label>
                <span className={`text-[11px] font-mono ${justification.trim().length >= 15 && justification.trim().length <= 255 ? "text-emerald-600 font-bold" : "text-amber-600"}`}>
                  {justification.trim().length}/255 caracteres (mínimo 15)
                </span>
              </div>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Informe o motivo pelo qual a operação não foi realizada (ex: Mercadorias devolvidas por avaria na entrega)..."
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-teal-500 focus:outline-hidden"
              />
            </div>
          )}

          {/* Resultado / Protocolo */}
          {result && (
            <div className={`rounded-xl p-4 border text-xs ${result.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
              <p className="font-bold">{result.ok ? "Evento Transmitido com Sucesso!" : "Falha na Transmissão"}</p>
              <p className="mt-1">{result.message}</p>
              {result.protocol && (
                <p className="mt-2 text-[11px] font-mono bg-white/70 p-2 rounded-lg border border-emerald-300">
                  Protocolo SEFAZ: <span className="font-bold text-slate-900">{result.protocol}</span>
                </p>
              )}
            </div>
          )}

          {/* Footer Botoes */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || (eventType === "NOT_PERFORMED" && (justification.trim().length < 15 || justification.trim().length > 255))}
              className="rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {submitting ? "Transmitindo SEFAZ..." : "Transmitir Evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
