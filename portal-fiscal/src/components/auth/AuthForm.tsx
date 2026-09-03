"use client";
import { useActionState } from "react";
import type { AuthState } from "@/app/auth-actions";

export function AuthForm({ action, setup = false }: { action: (state: AuthState, formData: FormData) => Promise<AuthState>; setup?: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="mt-8 space-y-4">
    {setup ? <label className="block text-sm font-semibold text-slate-700">Seu nome<input name="name" required autoComplete="name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" /></label> : null}
    <label className="block text-sm font-semibold text-slate-700">E-mail<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" /></label>
    <label className="block text-sm font-semibold text-slate-700">Senha<input name="password" type="password" required minLength={setup ? 12 : undefined} autoComplete={setup ? "new-password" : "current-password"} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" /></label>
    {setup ? <p className="text-xs leading-5 text-slate-500">Mínimo de 12 caracteres, incluindo maiúscula, minúscula, número e símbolo.</p> : null}
    {state.error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p> : null}
    <button disabled={pending} className="w-full rounded-xl bg-[#0d7273] px-4 py-3 font-semibold text-white hover:bg-[#095d5e] disabled:opacity-60">{pending ? "Aguarde..." : setup ? "Criar administrador" : "Entrar com segurança"}</button>
  </form>;
}
