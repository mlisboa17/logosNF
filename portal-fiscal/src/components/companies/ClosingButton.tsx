"use client";

import { useState } from "react";
import { MonthPickerModal } from "@/components/shared/MonthPickerModal";
import { toast } from "@/lib/ui/toast";

interface ClosingButtonProps {
  companyId: string;
  documentCount: number;
}

export function ClosingButton({ companyId, documentCount }: ClosingButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (documentCount === 0) return null;

  const handleMonthSelect = async (year: number, month: number) => {
    setIsLoading(true);

    try {
      const loadingId = toast.loading(
        `Preparando fechamento de ${month}/${year}...`,
        "Aguarde"
      );

      const response = await fetch(`/api/companies/${companyId}/closing`, {
        method: "GET",
        headers: {
          "X-Closing-Year": String(year),
          "X-Closing-Month": String(month),
        },
      });

      if (!response.ok) {
        throw new Error("Falha ao gerar fechamento");
      }

      // Download do arquivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fechamento-${year}-${String(month).padStart(2, "0")}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Remover loading toast
      const successId = toast.success(
        "Fechamento preparado!",
        `Download iniciado para ${month}/${year}`
      );
    } catch (error) {
      toast.error(
        "Erro ao gerar fechamento",
        error instanceof Error ? error.message : "Tente novamente"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={isLoading}
        className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Preparando..." : "Fechamento Mensal (ZIP)"}
      </button>

      <MonthPickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleMonthSelect}
        title="Fechamento Mensal"
        description="Selecione o mês para gerar o fechamento (XML, PDF e relatório)"
      />
    </>
  );
}
