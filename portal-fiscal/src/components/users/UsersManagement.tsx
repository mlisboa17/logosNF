"use client";

import { useState } from "react";
import { createUserMember, removeMember, updateMemberRole } from "@/app/actions";

export type MemberItem = {
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "ACCOUNTANT" | "VIEWER";
};

type Props = {
  members: MemberItem[];
  currentUserId: string;
  currentUserRole: string;
};

const ROLE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  OWNER: { label: "Proprietário", bg: "bg-purple-50", text: "text-purple-700" },
  ADMIN: { label: "Administrador", bg: "bg-blue-50", text: "text-blue-700" },
  ACCOUNTANT: { label: "Fiscal/Contador", bg: "bg-emerald-50", text: "text-emerald-700" },
  VIEWER: { label: "Consulta (Leitura)", bg: "bg-slate-100", text: "text-slate-700" },
};

export function UsersManagement({ members, currentUserId, currentUserRole }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  if (!isAdmin) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
      >
        <svg className="size-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
        <span>Gerenciar Equipe ({members.length})</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Gestão da Equipe & Permissões</h2>
                <p className="text-xs text-slate-500">Gerencie os usuários da organização e seus níveis de acesso.</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex justify-between items-center">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="font-bold cursor-pointer">×</button>
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Membros Cadastrados</span>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition cursor-pointer"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {showAddForm ? "Cancelar" : "Novo Membro"}
              </button>
            </div>

            {showAddForm && (
              <form
                action={async (formData) => {
                  try {
                    setError(null);
                    await createUserMember(formData);
                    setShowAddForm(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erro ao cadastrar usuário.");
                  }
                }}
                className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
              >
                <h3 className="text-xs font-bold text-slate-800 uppercase">Adicionar Novo Usuário</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Nome</label>
                    <input
                      name="name"
                      type="text"
                      required
                      placeholder="Ex: Maria Silva"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">E-mail</label>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="maria@empresa.com"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Senha Inicial</label>
                    <input
                      name="password"
                      type="password"
                      required
                      placeholder="Mínimo 12 caracteres"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Papel de Acesso</label>
                    <select
                      name="role"
                      defaultValue="VIEWER"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-hidden"
                    >
                      <option value="VIEWER">Consulta (Somente Leitura)</option>
                      <option value="ACCOUNTANT">Fiscal/Contador (Operações Fiscais)</option>
                      <option value="ADMIN">Administrador</option>
                      <option value="OWNER">Proprietário</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer"
                  >
                    Salvar e Convidar
                  </button>
                </div>
              </form>
            )}

            <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
              {members.map((member) => {
                const badge = ROLE_LABELS[member.role] || ROLE_LABELS.VIEWER;
                const isSelf = member.userId === currentUserId;

                return (
                  <div key={member.userId} className="flex items-center justify-between p-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="grid size-8 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 uppercase">
                        {member.name.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{member.name}</span>
                          {isSelf && <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">Você</span>}
                        </div>
                        <span className="text-[11px] text-slate-500">{member.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <form
                        action={async (formData) => {
                          try {
                            setError(null);
                            await updateMemberRole(formData);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Falha ao alterar papel.");
                          }
                        }}
                      >
                        <input type="hidden" name="userId" value={member.userId} />
                        <select
                          name="role"
                          value={member.role}
                          disabled={isSelf}
                          onChange={(e) => e.target.form?.requestSubmit()}
                          className={`rounded-lg border border-transparent px-2.5 py-1 text-xs font-semibold ${badge.bg} ${badge.text} cursor-pointer focus:outline-hidden disabled:opacity-80`}
                        >
                          <option value="OWNER">Proprietário</option>
                          <option value="ADMIN">Administrador</option>
                          <option value="ACCOUNTANT">Fiscal/Contador</option>
                          <option value="VIEWER">Consulta (Leitura)</option>
                        </select>
                      </form>

                      {!isSelf && (
                        <form
                          action={async (formData) => {
                            if (!confirm(`Deseja remover ${member.name} da equipe?`)) return;
                            try {
                              setError(null);
                              await removeMember(formData);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Falha ao remover.");
                            }
                          }}
                        >
                          <input type="hidden" name="userId" value={member.userId} />
                          <button
                            type="submit"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                            title="Remover usuário"
                          >
                            <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
