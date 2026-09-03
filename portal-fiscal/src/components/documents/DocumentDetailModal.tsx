"use client";

import { useEffect, useState } from "react";
import type { FiscalDocumentDetails } from "@/lib/fiscal/details-parser";
import { updateDocumentMetadata } from "@/app/actions";

type Props = {
  documentId: string | null;
  onClose: () => void;
};

export function DocumentDetailModal({ documentId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ details: FiscalDocumentDetails; companyName: string; rawXml: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "items" | "taxes" | "timeline" | "xml">("overview");

  useEffect(() => {
    if (!documentId) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/documents/${documentId}/details`)
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar detalhes do documento.");
        return res.json();
      })
      .then((json) => {
        if (isMounted) setData(json);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Erro de conexão.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [documentId]);

  if (!documentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header do Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Detalhe Fiscal do Documento</h2>
              {data?.details.isSummary && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Somente Resumo</span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono">Chave: {data?.details.accessKey || documentId}</p>
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

        {/* Abas do Modal */}
        <div className="flex border-b border-slate-100 bg-white px-6 gap-2 text-xs font-semibold">
          {[
            { id: "overview", label: "Visão Geral & Partes" },
            { id: "items", label: `Itens & Serviços (${data?.details.items.length || 0})` },
            { id: "taxes", label: "Tributação & IBS/CBS" },
            { id: "timeline", label: "Linha do Tempo" },
            { id: "xml", label: "XML Bruto" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 border-b-2 transition cursor-pointer ${
                activeTab === tab.id
                  ? "border-teal-600 text-teal-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conteudo */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-slate-700">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="size-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent mb-3" />
              <span>Carregando XML e decodificando estrutura fiscal...</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-bold">Erro ao abrir detalhe</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Aba Visao Geral */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Emitente */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Emitente (Prestador / Vendedor)</span>
                      <p className="font-bold text-sm text-slate-900">{data.details.issuer.name}</p>
                      <p className="text-slate-600">CNPJ/CPF: <span className="font-mono">{data.details.issuer.taxId}</span></p>
                      <p className="text-slate-600">Inscrição Estadual: {data.details.issuer.stateRegistration}</p>
                      <p className="text-slate-600">UF / Local: {data.details.issuer.cityUf}</p>
                    </div>

                    {/* Destinatario */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Destinatário (Tomador / Comprador)</span>
                      <p className="font-bold text-sm text-slate-900">{data.details.recipient.name}</p>
                      <p className="text-slate-600">CNPJ/CPF: <span className="font-mono">{data.details.recipient.taxId}</span></p>
                      <p className="text-slate-600">Inscrição Estadual: {data.details.recipient.stateRegistration}</p>
                      <p className="text-slate-600">UF / Local: {data.details.recipient.cityUf}</p>
                    </div>
                  </div>

                  {/* Resumo de Valores */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resumo Financeiro do Documento</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Valor Produtos</span>
                        <span className="font-bold text-sm text-slate-800">
                          R$ {data.details.totals.productsTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Descontos</span>
                        <span className="font-bold text-sm text-slate-800">
                          R$ {data.details.totals.discountTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Frete / Outros</span>
                        <span className="font-bold text-sm text-slate-800">
                          R$ {data.details.totals.freightTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Valor Total NFe</span>
                        <span className="font-bold text-sm text-emerald-700">
                          R$ {data.details.totals.grandTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Organizacao & Produtividade */}
                  <form
                    action={async (formData) => {
                      try {
                        await updateDocumentMetadata(formData);
                        alert("Metadados atualizados com sucesso!");
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Falha ao salvar.");
                      }
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                  >
                    <input type="hidden" name="documentId" value={documentId} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Organização & Produtividade Interna</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">Etiquetas / Tags (separadas por vírgula)</label>
                        <input
                          name="tags"
                          type="text"
                          placeholder="Ex: Urgente, Conferido, Projeto X"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">Responsável Operacional</label>
                        <input
                          name="assignedTo"
                          type="text"
                          placeholder="Nome do operador ou contador"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700">Notas / Comentários Internos</label>
                      <textarea
                        name="internalComment"
                        rows={2}
                        placeholder="Adicione observações internas sobre este documento..."
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-hidden"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer shadow-xs"
                      >
                        Salvar Observações
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Aba Itens */}
              {activeTab === "items" && (
                <div className="space-y-4">
                  {!data.details.items.length ? (
                    <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl">
                      Itemização indisponível. Este documento é um resumo de NF-e (resNFe).
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 uppercase text-[10px] text-slate-500">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">Código</th>
                            <th className="p-3">Descrição</th>
                            <th className="p-3">NCM</th>
                            <th className="p-3 text-right">Qtd</th>
                            <th className="p-3 text-right">V. Unit</th>
                            <th className="p-3 text-right">V. Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.details.items.map((item) => (
                            <tr key={item.itemNumber} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-400">{item.itemNumber}</td>
                              <td className="p-3 font-mono text-slate-600">{item.code}</td>
                              <td className="p-3 font-medium text-slate-900">{item.description}</td>
                              <td className="p-3 font-mono text-slate-500">{item.ncm}</td>
                              <td className="p-3 text-right">{item.quantity}</td>
                              <td className="p-3 text-right">R$ {item.unitValue?.toFixed(2)}</td>
                              <td className="p-3 text-right font-bold text-slate-900">R$ {item.totalValue.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Aba Tributacao & Reforma */}
              {activeTab === "taxes" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="text-[10px] font-bold text-slate-400 block">ICMS Total</span>
                      <span className="font-bold text-sm text-slate-900">R$ {data.details.taxes.icmsTotal.toFixed(2)}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="text-[10px] font-bold text-slate-400 block">IPI Total</span>
                      <span className="font-bold text-sm text-slate-900">R$ {data.details.taxes.ipiTotal.toFixed(2)}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="text-[10px] font-bold text-slate-400 block">PIS Total</span>
                      <span className="font-bold text-sm text-slate-900">R$ {data.details.taxes.pisTotal.toFixed(2)}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="text-[10px] font-bold text-slate-400 block">COFINS Total</span>
                      <span className="font-bold text-sm text-slate-900">R$ {data.details.taxes.cofinsTotal.toFixed(2)}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="text-[10px] font-bold text-slate-400 block">ISS Total</span>
                      <span className="font-bold text-sm text-slate-900">R$ {data.details.taxes.issTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Reforma Tributaria IBS / CBS Placeholder */}
                  <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white">Reforma Tributária</span>
                      <span className="text-xs font-bold text-teal-950">Projeção IBS / CBS (LC 214/2024)</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Estrutura preparada para os novos tributos da reforma (Imposto sobre Bens e Serviços e Contribuição sobre Bens e Serviços).
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-teal-200/60">
                      <div>
                        <span className="text-teal-800 font-semibold block text-[11px]">IBS Estimado:</span>
                        <span className="font-bold text-sm text-teal-900">R$ {data.details.taxes.ibsEstimate.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-teal-800 font-semibold block text-[11px]">CBS Estimada:</span>
                        <span className="font-bold text-sm text-teal-900">R$ {data.details.taxes.cbsEstimate.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Aba Linha do Tempo */}
              {activeTab === "timeline" && (
                <div className="space-y-4 relative pl-4 border-l-2 border-slate-200">
                  {data.details.timeline.map((evt, idx) => (
                    <div key={idx} className="relative mb-6">
                      <div className="absolute -left-[23px] top-1 size-3.5 rounded-full bg-teal-600 border-2 border-white" />
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{evt.title}</span>
                        <span className="text-[10px] text-slate-400">{new Date(evt.date).toLocaleString("pt-BR")}</span>
                      </div>
                      <p className="mt-1 text-slate-600 text-[11px]">{evt.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Aba XML Bruto */}
              {activeTab === "xml" && (
                <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-96">
                  <pre>{data.rawXml}</pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer do Modal */}
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
