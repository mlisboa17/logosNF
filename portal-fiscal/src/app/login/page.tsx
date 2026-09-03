import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { login } from "../auth-actions";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  if (await db.user.count() === 0) redirect("/setup");
  return <AuthShell title="Acesse o painel" description="Use sua conta para consultar documentos e executar operações fiscais."><AuthForm action={login} /></AuthShell>;
}

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-[#eef4f3] p-5"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[#0d7273] font-black text-white">F</div><div><p className="font-bold">FiscalBox</p><p className="text-xs text-slate-500">Ambiente fiscal protegido</p></div></div><h1 className="mt-8 text-2xl font-bold">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>{children}</section></main>;
}
