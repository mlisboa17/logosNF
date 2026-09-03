"use client";

interface PaginationProps {
  hasMore: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  isLoading?: boolean;
  pageSize?: number;
  itemsCount?: number;
}

export function Pagination({
  hasMore,
  onNextPage,
  onPrevPage,
  isLoading = false,
  pageSize = 25,
  itemsCount = 0,
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 mt-6">
      <div className="text-sm text-slate-600">
        {itemsCount > 0 && <span>Mostrando {itemsCount} de muitos registros</span>}
        {itemsCount === 0 && <span>Nenhum registro encontrado</span>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onPrevPage}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ← Anterior
        </button>

        <button
          onClick={onNextPage}
          disabled={!hasMore || isLoading}
          className="px-4 py-2 rounded-lg bg-[#0d7273] text-sm font-semibold text-white hover:bg-[#095d5e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Próxima →
        </button>
      </div>
    </div>
  );
}
