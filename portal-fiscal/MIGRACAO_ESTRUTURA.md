# 📂 MAPA DE MIGRAÇÃO - Reestruturação de Pastas

**Objetivo**: Escalabilidade - organizar por domínio funcional

---

## MAPEAMENTO DE ARQUIVOS

### COMPONENTES REACT (src/components/)

```
ANTES: src/app/audit-logs.tsx
DEPOIS: src/components/audit/AuditLogsTable.tsx

ANTES: src/app/certificate-company-form.tsx
DEPOIS: src/components/companies/CertificateCompanyForm.tsx

ANTES: src/app/company-scope-selector.tsx
DEPOIS: src/components/companies/CompanyScopeSelector.tsx

ANTES: src/app/document-detail-modal.tsx
DEPOIS: src/components/documents/DocumentDetailModal.tsx

ANTES: src/app/documents-table.tsx
DEPOIS: src/components/documents/DocumentsTable.tsx

ANTES: src/app/users-management.tsx
DEPOIS: src/components/users/UsersManagement.tsx

ANTES: src/app/operational-overview.tsx
DEPOIS: src/components/overview/OperationalOverview.tsx

ANTES: src/app/cnpj-input.tsx
DEPOIS: src/components/shared/CnpjInput.tsx

ANTES: src/app/auth-form.tsx
DEPOIS: src/components/auth/AuthForm.tsx
```

### SERVER ACTIONS (src/server/)

```
ANTES: src/app/actions.ts (200+ linhas)
DEPOIS: src/server/companies.ts (company actions)
DEPOIS: src/server/certificates.ts (certificate actions)
DEPOIS: src/server/audit.ts (audit actions)
DEPOIS: src/server/index.ts (re-exports para compat)

ANTES: src/app/auth-actions.ts
DEPOIS: src/server/auth.ts
```

### LAYOUT & PAGES (src/app/ - apenas estrutura)

```
src/app/
├── layout.tsx (mantém)
├── globals.css (mantém)
├── page.tsx (REFATOR - 300 linhas)
├── login/
│   └── page.tsx (mantém)
├── setup/
│   └── page.tsx (mantém)
└── api/ (mantém)
```

---

## 📋 CHECKLIST DE MIGRAÇÃO

### Phase 1: Criar Estrutura (30 min)
- [ ] mkdir src/components
- [ ] mkdir src/components/{audit,companies,documents,users,overview,shared,auth}
- [ ] mkdir src/server
- [ ] mkdir src/app/(auth)

### Phase 2: Mover Componentes (1 hora)
- [ ] cp audit-logs.tsx → components/audit/
- [ ] cp certificate-company-form.tsx → components/companies/
- [ ] cp company-scope-selector.tsx → components/companies/
- [ ] cp document-detail-modal.tsx → components/documents/
- [ ] cp documents-table.tsx → components/documents/
- [ ] cp users-management.tsx → components/users/
- [ ] cp operational-overview.tsx → components/overview/
- [ ] cp cnpj-input.tsx → components/shared/
- [ ] cp auth-form.tsx → components/auth/

### Phase 3: Mover Server Actions (45 min)
- [ ] Dividir actions.ts → companies.ts, certificates.ts, audit.ts
- [ ] Mover auth-actions.ts → server/auth.ts
- [ ] Criar src/server/index.ts com re-exports

### Phase 4: Atualizar Imports (1 hora)
- [ ] page.tsx: atualizar todos imports
- [ ] login/page.tsx: atualizar imports
- [ ] api/*: atualizar imports
- [ ] Todos os arquivos referenciando componentes antigos

### Phase 5: Testar (1 hora)
- [ ] npm run dev
- [ ] Testar navegação completa
- [ ] Testar login/logout
- [ ] Testar criação de empresa
- [ ] Testar sincronização

### Phase 6: Limpeza (15 min)
- [ ] Remover arquivos antigos de src/app/*.tsx
- [ ] Verificar que nenhum arquivo antigo é referenciado
- [ ] Commit

---

## IMPACTO NO CÓDIGO

### Antes
```
src/app/
├── page.tsx (1000+ linhas) 🔴 Gigante
├── actions.ts (200+ linhas)
├── auth-actions.ts
├── audit-logs.tsx
├── certificate-company-form.tsx
├── company-scope-selector.tsx
├── document-detail-modal.tsx
├── documents-table.tsx
├── users-management.tsx
├── operational-overview.tsx
├── cnpj-input.tsx
├── auth-form.tsx
└── ... 12 componentes misturados
```

### Depois
```
src/
├── app/
│   ├── page.tsx (300 linhas) ✅ Mantenível
│   ├── layout.tsx
│   ├── globals.css
│   ├── login/
│   ├── setup/
│   └── api/
├── components/ (novo)
│   ├── audit/
│   ├── companies/
│   ├── documents/
│   ├── users/
│   ├── overview/
│   ├── shared/
│   └── auth/
├── server/ (novo)
│   ├── auth.ts
│   ├── companies.ts
│   ├── certificates.ts
│   ├── audit.ts
│   └── index.ts
└── lib/
    ├── auth/
    ├── fiscal/
    ├── security/
    ├── db.ts
    └── logging.ts (novo)
```

---

## GANHOS ESPERADOS

| Métrica | Antes | Depois |
|---------|-------|--------|
| Arquivo maior | 1000 linhas | 300 linhas |
| Componentes em app/ | 12 | 0 |
| Clareza de estrutura | 🟡 Confusa | ✅ Clara |
| Escalabilidade | 🟡 Difícil | ✅ Fácil |
| Time onboarding | 🟠 Lento | ✅ Rápido |

---

## STATUS

Pronto para iniciar Fase 1: Criar Estrutura

Tempo estimado total: 4-5 horas
