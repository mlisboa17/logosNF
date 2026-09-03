"use client";

import { useState } from "react";

interface MonthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (year: number, month: number) => void;
  title?: string;
  description?: string;
}

export function MonthPickerModal({
  isOpen,
  onClose,
  onSelect,
  title = "Selecionar Mês",
  description = "Escolha o mês para a operação",
}: MonthPickerModalProps) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-11

  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const handleSubmit = () => {
    onSelect(selectedYear, selectedMonth + 1); // Converter para 1-12
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-2xl bg-white p-8 shadow-2xl max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>

        <div className="mt-6 space-y-4">
          {/* Seletor de Ano */}
          <div>
            <label className="block text-sm font-semibold mb-2">Ano</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-600"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Grid de Meses */}
          <div>
            <label className="block text-sm font-semibold mb-3">Mês</label>
            <div className="grid grid-cols-3 gap-2">
              {months.map((month, index) => (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(index)}
                  className={`py-2 px-2 rounded-lg text-sm font-semibold transition-colors ${
                    selectedMonth === index
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Resumo */}
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="text-slate-600">
              Selecionado: <span className="font-semibold">{months[selectedMonth]} de {selectedYear}</span>
            </p>
          </div>
        </div>

        {/* Botões */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
