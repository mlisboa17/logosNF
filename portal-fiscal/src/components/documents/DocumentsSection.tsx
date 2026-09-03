"use client";

import { useSearchParams } from "next/navigation";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { Pagination } from "@/components/shared/Pagination";

interface DocumentsSectionProps {
  documents: any[];
  hasMore: boolean;
  nextCursor?: string;
  pendingSince: string;
}

export function DocumentsSection({
  documents,
  hasMore,
  nextCursor,
  pendingSince,
}: DocumentsSectionProps) {
  const searchParams = useSearchParams();
  const currentCompanyId = searchParams.get("companyId");

  const handleNextPage = () => {
    if (!nextCursor) return;
    const params = new URLSearchParams(searchParams);
    params.set("cursor", nextCursor);
    window.location.href = `?${params.toString()}`;
  };

  const handlePrevPage = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("cursor");
    window.location.href = `?${params.toString()}`;
  };

  return (
    <section id="documentos" className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-6">
        <div>
          <h3 className="text-lg font-bold">Documentos fiscais</h3>
          <p className="text-sm text-slate-500">
            Mostrando {documents.length} registros por página
          </p>
        </div>
      </div>
      <DocumentsTable pendingSince={pendingSince} documents={documents} />
      <div className="border-t border-slate-100 p-6">
        <Pagination
          hasMore={hasMore}
          itemsCount={documents.length}
          pageSize={25}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
        />
      </div>
    </section>
  );
}
