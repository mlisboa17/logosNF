"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type CompanyOption = { id: string; name: string; cnpj: string };
export function CompanyScopeSelector({ companies, selectedId }: { companies: CompanyOption[]; selectedId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <label className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
    <span className="hidden text-xs font-semibold uppercase tracking-wider text-slate-400 sm:block">Empresa</span>
    <select aria-label="Filtrar painel por empresa" value={selectedId} disabled={pending} onChange={(event) => startTransition(() => router.replace(event.target.value ? `/?companyId=${encodeURIComponent(event.target.value)}` : "/"))} className="min-w-0 max-w-64 bg-transparent text-sm font-semibold text-slate-700 outline-none disabled:opacity-60">
      <option value="">Todas as empresas</option>
      {companies.map((company) => <option key={company.id} value={company.id}>{company.name} · {company.cnpj}</option>)}
    </select>
  </label>;
}
