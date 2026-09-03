"use client";

import { useActionState } from "react";
import { importCompanyFromCertificate, type CertificateImportState } from "@/app/actions";

const initialState: CertificateImportState = { ok: false, message: "" };

export function CertificateCompanyForm() {
  const [state, action, pending] = useActionState(importCompanyFromCertificate, initialState);

  return (
    <form action={action} className="rounded-2xl border border-teal-200 bg-teal-50/60 p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Cadastro automático</p>
      <h3 className="mt-1 text-xl font-bold">Adicionar pelo certificado A1</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">O CNPJ, o titular e a validade serão identificados no arquivo.</p>
      <div className="mt-5 space-y-4">
        <label className="block text-sm font-semibold">Arquivo A1 (.pfx ou .p12)<input name="certificate" type="file" required accept=".pfx,.p12,application/x-pkcs12" className="mt-2 block w-full rounded-xl border border-teal-200 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-100 file:px-3 file:py-2 file:font-semibold file:text-teal-800" /></label>
        <label className="block text-sm font-semibold">Senha do certificado<input name="password" type="password" required autoComplete="new-password" className="mt-2 w-full rounded-xl border border-teal-200 bg-white px-4 py-3 font-normal outline-none focus:border-teal-600" placeholder="Senha do A1" /></label>
        <button disabled={pending} className="w-full rounded-xl bg-[#0d7273] px-4 py-3 font-semibold text-white hover:bg-[#095d5e] disabled:cursor-wait disabled:opacity-60">{pending ? "Validando certificado..." : "Ler certificado e adicionar"}</button>
        {state.message && <p role="status" className={`rounded-xl px-4 py-3 text-sm font-medium ${state.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{state.message}</p>}
      </div>
    </form>
  );
}
