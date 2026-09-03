import { createCompany, setCompanyNfseEnvironment, syncCompanyNfse, syncCompanyNfe } from "./actions";
import { db } from "@/lib/db";
import { formatCnpj } from "@/lib/fiscal/cnpj";
import { CertificateCompanyForm } from "@/components/companies/CertificateCompanyForm";
import { DocumentsSection } from "@/components/documents/DocumentsSection";
import { CompanyScopeSelector } from "@/components/companies/CompanyScopeSelector";
import { CnpjInput } from "@/components/shared/CnpjInput";
import { ClosingButton } from "@/components/companies/ClosingButton";
import { organizationIds, requireSession } from "@/lib/auth/session";
import { logout } from "./auth-actions";
import { OperationalOverview } from "@/components/overview/OperationalOverview";
import { UsersManagement } from "@/components/users/UsersManagement";
import { AuditLogsTable } from "@/components/audit/AuditLogsTable";
import { getDocumentsPaginated } from "@/server/queries";

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700">{children}</span>;
}

function certificateWarningLimit() {
  return new Date(Date.now() + 30 * 24 * 60 * 60_000);
}

function pendingWindowStart() {
  return new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
}

export default async function Home({ searchParams }: { searchParams: Promise<{ companyId?: string; cursor?: string }> }) {
  const session = await requireSession();
  const allowedOrganizationIds = organizationIds(session);
  const params = await searchParams;
  const requestedCompanyId = params.companyId ?? "";
  const documentCursor = params.cursor;
  const documentWhere = { company: { organizationId: { in: allowedOrganizationIds } }, ...(requestedCompanyId ? { companyId: requestedCompanyId } : {}) };

  const [companies, paginatedDocuments, documentCount, eventCount, organizationMembers, auditEntries] = await Promise.all([db.company.findMany({
    where: { organizationId: { in: allowedOrganizationIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, legalName: true, tradeName: true, cnpj: true, status: true, nfseEnvironment: true,
      _count: { select: { documents: true } },
      cursors: { select: { source: true, lastNsu: true, lastSyncAt: true } },
      syncRuns: { orderBy: { startedAt: "desc" }, select: { status: true, documentCount: true, errorMessage: true }, take: 1 },
      certificate: { select: { validUntil: true } },
    },
  }), getDocumentsPaginated(allowedOrganizationIds, requestedCompanyId ? { companyId: requestedCompanyId } : {}, { limit: 25, cursor: documentCursor }), db.fiscalDocument.count({ where: documentWhere }), db.fiscalDocument.count({ where: { ...documentWhere, kind: { in: ["NFSE_EVENT", "NFE_EVENT"] } } }), db.membership.findMany({
    where: { organizationId: { in: allowedOrganizationIds } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { role: "asc" },
  }), db.auditEntry.findMany({
    where: { organizationId: { in: allowedOrganizationIds } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true, email: true } } },
  })]);

  const membersList = organizationMembers.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));

  const selectedCompanyId = companies.some((company) => company.id === requestedCompanyId) ? requestedCompanyId : "";
  const readyCompanies = companies.filter((company) => company.status === "READY").length;
  const failedCompanies = companies.filter((company) => company.syncRuns[0]?.status === "FAILED").length;
  const certificateWarningDate = certificateWarningLimit();
  const expiringCertificates = companies.filter((company) => company.certificate && company.certificate.validUntil <= certificateWarningDate).length;
  const lastSyncAt = companies.flatMap((company) => company.cursors.map((cursor) => cursor.lastSyncAt)).filter((date): date is Date => date !== null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const primaryRole = session.user.memberships[0]?.role ?? "VIEWER";
  const roleLabel = { OWNER: "Proprietário", ADMIN: "Administrador", ACCOUNTANT: "Fiscal", VIEWER: "Consulta" }[primaryRole];
  return (
    <div className="min-h-screen bg-[#f5f7f7] text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-[#092f33] px-5 py-7 text-white lg:block">
        <div className="flex items-center gap-3 px-2">
          <div className="grid size-10 place-items-center rounded-xl bg-teal-400 font-black text-[#092f33]">F</div>
          <div><p className="font-bold tracking-tight">FiscalBox</p><p className="text-xs text-teal-100/60">Documentos fiscais</p></div>
        </div>
        <nav className="mt-10 space-y-2 text-sm">
          <a className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 font-semibold" href="#">Visão geral</a>
          <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-teal-50/70 hover:bg-white/5" href="#documentos">Documentos</a>
          <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-teal-50/70 hover:bg-white/5" href="#nfe">NF-e (mercadorias)</a>
          <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-teal-50/70 hover:bg-white/5" href="#empresas">Empresas</a>
          <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-teal-50/70 hover:bg-white/5" href="#integracao">Integrações</a>
        </nav>
        <div className="absolute bottom-6 left-5 right-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-teal-300 font-bold text-[#092f33]">{session.user.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{session.user.name}</p><p className="text-xs text-teal-100/60">{roleLabel}</p></div></div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3"><span className="size-2 rounded-full bg-emerald-400"/><p className="text-xs text-teal-50/65">Sessão protegida · 8 horas</p></div>
        </div>
      </aside>

      <main className="lg:ml-64">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 sm:px-8">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-700">Painel fiscal</p><h1 className="text-xl font-bold">Visão geral</h1></div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <CompanyScopeSelector companies={companies.map((company) => ({ id: company.id, name: company.tradeName || company.legalName, cnpj: formatCnpj(company.cnpj) }))} selectedId={selectedCompanyId} />
            <UsersManagement members={membersList} currentUserId={session.userId} currentUserRole={primaryRole} />
            {(primaryRole === "OWNER" || primaryRole === "ADMIN") && (
              <AuditLogsTable
                entries={auditEntries.map((e) => ({
                  id: e.id,
                  action: e.action,
                  entityType: e.entityType,
                  entityId: e.entityId,
                  createdAt: e.createdAt.toISOString(),
                  userName: e.user?.name || "Sistema",
                  userEmail: e.user?.email || "—",
                  metadata: e.metadata,
                }))}
              />
            )}
            {primaryRole !== "VIEWER" && (
              <a href="#empresas" className="rounded-xl bg-[#0d7273] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#095d5e]">+ Adicionar empresa</a>
            )}
            <form action={logout}><button title={`Sair da conta de ${session.user.name}`} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Sair</button></form>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-8 p-5 sm:p-8">
          <OperationalOverview userName={session.user.name} documentCount={documentCount} companyCount={companies.length} readyCompanies={readyCompanies} eventCount={eventCount} failedCompanies={failedCompanies} expiringCertificates={expiringCertificates} lastSyncAt={lastSyncAt?.toISOString() ?? null} />
          <section className="hidden">
            <div className="max-w-2xl">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Sistema Nacional NFS-e • ADN</span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Todas as notas das suas empresas, em um só lugar.</h2>
              <p className="mt-3 max-w-xl leading-7 text-teal-50/80">Consulta automática de documentos em que seus CNPJs aparecem como prestador, tomador ou intermediário.</p>
            </div>
          </section>

          <section className="hidden">
            {[
              ["Documentos", String(documentCount), "NFS-e importadas"],
              ["Empresas", String(companies.length), "CNPJs cadastrados"],
              ["Valor no mês", "R$ 0,00", "Total das notas"],
              ["Último NSU", "—", "Sincronização ADN"],
            ].map(([label, value, detail]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
                <p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p>
              </article>
            ))}
          </section>

          <section className="hidden">
            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Primeiros passos</p><h3 className="mt-1 text-xl font-bold">Configure a primeira empresa</h3></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">0 de 3</span></div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  ["1", "Cadastrar CNPJ", "Dados da empresa"],
                  ["2", "Vincular A1", "Certificado e senha"],
                  ["3", "Sincronizar", "Buscar pelo NSU"],
                ].map(([step, title, desc]) => <div key={step} className="rounded-2xl bg-slate-50 p-4"><Icon>{step}</Icon><p className="mt-4 font-semibold">{title}</p><p className="mt-1 text-sm text-slate-500">{desc}</p></div>)}
              </div>
            </article>
            <article className="rounded-2xl bg-[#dff5ee] p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Conexão</p><h3 className="mt-2 text-xl font-bold text-emerald-950">ADN Nacional</h3><div className="mt-6 flex items-center gap-3"><span className="size-2.5 rounded-full bg-emerald-500"/><span className="text-sm font-semibold text-emerald-900">Integração preparada</span></div><p className="mt-4 text-sm leading-6 text-emerald-900/70">Aguardando certificado e CNPJ para a primeira consulta no ambiente restrito.</p>
            </article>
          </section>

          <DocumentsSection
            documents={paginatedDocuments.documents.map((document) => {
              const meta = document.rawMetadata ? (typeof document.rawMetadata === 'string' ? JSON.parse(document.rawMetadata) : document.rawMetadata) as { isSummary?: boolean } : null;
              return {
                id: document.id,
                kind: document.kind,
                accessKey: document.accessKey ?? "—",
                nsu: document.nsu.toString(),
                issuedAt: document.issuedAt?.toISOString() ?? null,
                companyName: document.company.legalName,
                manifestationStatus: document.manifestationStatus,
                lastDownloadedAt: document.lastDownloadedAt?.toISOString() ?? null,
                isSummary: meta?.isSummary,
              };
            })}
            hasMore={!!paginatedDocuments.nextCursor}
            nextCursor={paginatedDocuments.nextCursor ?? undefined}
            pendingSince={pendingWindowStart()}
          />

          <section id="nfe" className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Conector Ativo</p><h3 className="mt-1 text-xl font-bold text-blue-950">NF-e de mercadorias (SEFAZ)</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-blue-900/70">As NF-e destinadas ao seu CNPJ são capturadas via NFeDistribuicaoDFe da SEFAZ nacional com cursor NSU incremental e suporte a resumos (resNFe) e XMLs completos (procNFe).</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Conector Pronto</span></div>
          </section>

          <section id="empresas" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
            <CertificateCompanyForm />
            <form action={createCompany} className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Cadastro</p>
              <h3 className="mt-1 text-xl font-bold">Adicionar empresa</h3>
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-semibold">Razão social<input name="legalName" required minLength={3} maxLength={180} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-600" placeholder="Razão social completa" /></label>
                <label className="block text-sm font-semibold">Nome fantasia<input name="tradeName" maxLength={180} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-600" placeholder="Opcional" /></label>
                <CnpjInput name="cnpj" required />
                <button className="w-full rounded-xl bg-[#0d7273] px-4 py-3 font-semibold text-white hover:bg-[#095d5e]">Salvar empresa</button>
              </div>
            </form>
            </div>
            <div className="space-y-4">
              {companies.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nenhuma empresa cadastrada.</div>}
              {companies.map((company) => {
                const lastRun = company.syncRuns[0];
                const source = company.nfseEnvironment === "PRODUCTION" ? "ADN_NFSE_PRODUCTION" : "ADN_NFSE_RESTRICTED";
                const cursor = company.cursors.find((item) => item.source === source);
                return <article key={company.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><h3 className="font-bold">{company.tradeName || company.legalName}</h3><p className="mt-1 text-sm text-slate-500">{formatCnpj(company.cnpj)} · {company.legalName}</p><p className="mt-2 text-xs text-slate-400">Último NSU: {cursor?.lastNsu.toString() ?? "0"}{cursor?.lastSyncAt ? ` · sincronizado em ${cursor.lastSyncAt.toLocaleString("pt-BR")}` : ""}</p></div>
                    <div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${company.nfseEnvironment === "PRODUCTION" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{company.nfseEnvironment === "PRODUCTION" ? "Produção" : "Ambiente de teste"}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${company.status === "READY" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{company.status === "READY" ? "A1 vinculado" : "Aguardando A1"}</span>{company.status === "READY" && <form action={syncCompanyNfse}><input type="hidden" name="companyId" value={company.id}/><button className="rounded-xl bg-[#0d7273] px-4 py-2 text-sm font-semibold text-white hover:bg-[#095d5e]">{company.nfseEnvironment === "PRODUCTION" ? "Buscar NFS-e" : "Testar ADN"}</button></form>}{company.status === "READY" && <form action={syncCompanyNfe}><input type="hidden" name="companyId" value={company.id}/><button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Buscar NF-e (SEFAZ)</button></form>}{company._count.documents > 0 && <ClosingButton companyId={company.id} documentCount={company._count.documents} />}{company._count.documents > 0 && <a href={`/api/companies/${company.id}/documents/archive`} className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50">Baixar lote ZIP</a>}{company.status === "READY" && lastRun?.status === "SUCCEEDED" && <form action={setCompanyNfseEnvironment}><input type="hidden" name="companyId" value={company.id}/><input type="hidden" name="target" value={company.nfseEnvironment === "PRODUCTION" ? "RESTRICTED" : "PRODUCTION"}/><button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">{company.nfseEnvironment === "PRODUCTION" ? "Voltar para teste" : "Liberar produção"}</button></form>}</div>
                  </div>
                  {lastRun && <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${lastRun.status === "SUCCEEDED" ? "bg-emerald-50 text-emerald-800" : lastRun.status === "FAILED" ? "bg-red-50 text-red-800" : "bg-slate-50 text-slate-700"}`}>{lastRun.status === "SUCCEEDED" ? `Sincronização concluída: ${lastRun.documentCount} novo(s) documento(s).` : lastRun.status === "FAILED" ? `Falha: ${lastRun.errorMessage}` : "Sincronização em andamento."}</p>}
                </article>;
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
