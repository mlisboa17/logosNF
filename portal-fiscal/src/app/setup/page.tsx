import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { setupAdmin } from "../auth-actions";
import { AuthForm } from "@/components/auth/AuthForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await db.user.count() > 0) redirect("/login");
  return <main className="grid min-h-screen place-items-center bg-[#082f33] p-5"><section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Primeiro acesso</p><h1 className="mt-3 text-2xl font-bold">Crie o administrador</h1><p className="mt-2 text-sm leading-6 text-slate-500">Esta etapa aparece somente uma vez. O administrador terá acesso às empresas e às configurações de segurança.</p><AuthForm action={setupAdmin} setup /></section></main>;
}
