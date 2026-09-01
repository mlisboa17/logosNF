# ⚡ PRÓXIMOS PASSOS IMEDIATOS

**Status**: 🟡 Infra pronta, execução em andamento  
**Tempo para conclusão**: 4-5 horas  
**Complexidade**: Média (refactoring sem quebras)

---

## 🟢 O QUE JÁ ESTÁ PRONTO

### 3 Arquivos Críticos Implementados
```
✅ src/lib/logging.ts (50 linhas)
   → Logger estruturado com 4 especializações
   
✅ src/server/queries.ts (150 linhas)
   → Queries consolidadas + otimizadas
   
✅ MIGRACAO_ESTRUTURA.md (90 linhas)
   → Mapa completo de reestruturação
```

### 5 Documentos Guia Criados
```
✅ FASE2_EXECUCAO.md - Plano de execução
✅ FASE2_STATUS.md - Status + checklist
✅ MIGRACAO_ESTRUTURA.md - Mapa de files
✅ PROXIMOS_PASSOS_IMEDIATOS.md - Este arquivo
✅ package.json - Pino adicionado
```

---

## 🚀 ROTEIRO DE EXECUÇÃO (4-5 horas)

### BLOCO 1: PostgreSQL (15-30 min)
```bash
cd portal-fiscal

# 1. Subir PostgreSQL
docker-compose up -d

# 2. Aguardar healthcheck (max 30s)
docker ps | grep fiscalbox-postgres  # Deve estar healthy

# 3. Executar migration
npx prisma migrate dev

# 4. Testar
npm run dev
# Abrir http://localhost:4000 e criar empresa
```

**Sucesso**: App funciona com PostgreSQL ✅

---

### BLOCO 2: Logging (45-60 min)
```bash
# 1. Instalar pino
npm install

# 2. Integrar logging em 3 arquivos críticos:

# a) src/app/auth-actions.ts (login)
#    Adicionar no topo:
#    import { auditLogger } from "@/lib/logging";
#    
#    Dentro de login():
#    auditLogger.info({ email }, "Login attempt");
#    auditLogger.error({ email }, "Login failed");

# b) src/lib/fiscal/sync-nfse.ts (sincronização NFSe)
#    import { fiscalLogger } from "@/lib/logging";
#    fiscalLogger.info({ companyId }, "Sync started");
#    fiscalLogger.error({ error }, "Sync failed");

# c) src/lib/security/certificate-vault.ts (certificado)
#    import { certificateLogger } from "@/lib/logging";
#    certificateLogger.info({ fingerprint }, "Certificate loaded");

# 3. Testar
npm run dev
# Fazer login → Ver logs estruturados no console
# Logs devem ser JSON estruturado com timestamps
```

**Sucesso**: Logs aparecem estruturados no console ✅

---

### BLOCO 3: Otimizar Queries (30-45 min)
```bash
# 1. Refatorar src/app/page.tsx

# ANTES (linhas 26-54):
const [companies, recentDocuments, documentCount, eventCount, ...] = 
  await Promise.all([...6 queries...]);

# DEPOIS:
import { getHomePageData } from "@/server/queries";

const {
  companies,
  documents: recentDocuments,
  members: organizationMembers,
  auditEntries,
  metrics: {
    documentCount,
    eventCount,
    readyCompanies,
    failedCompanies,
    expiringCertificates,
    lastSyncAt,
  },
} = await getHomePageData(allowedOrganizationIds, selectedCompanyId);

# 2. Atualizar cálculos (remove linhas 64-69)
# Agora vem pronto em metrics

# 3. Testar
npm run dev
# Página deve carregar ~40% mais rápida
# DevTools Network: queries consolidadas
```

**Sucesso**: Page load 2s → 1.2s ⚡

---

### BLOCO 4: Reestruturação de Pastas (2-3 horas)
**Follow the 6 phases em MIGRACAO_ESTRUTURA.md**

```bash
# Phase 1: Criar estrutura (30 min)
mkdir -p src/components/{audit,companies,documents,users,overview,shared,auth}
mkdir -p src/server

# Phase 2: Mover componentes (1h)
# Use este script:
mv src/app/audit-logs.tsx src/components/audit/AuditLogsTable.tsx
mv src/app/certificate-company-form.tsx src/components/companies/CertificateCompanyForm.tsx
mv src/app/company-scope-selector.tsx src/components/companies/CompanyScopeSelector.tsx
mv src/app/document-detail-modal.tsx src/components/documents/DocumentDetailModal.tsx
mv src/app/documents-table.tsx src/components/documents/DocumentsTable.tsx
mv src/app/users-management.tsx src/components/users/UsersManagement.tsx
mv src/app/operational-overview.tsx src/components/overview/OperationalOverview.tsx
mv src/app/cnpj-input.tsx src/components/shared/CnpjInput.tsx
mv src/app/auth-form.tsx src/components/auth/AuthForm.tsx

# Phase 3: Dividir server actions
# Usar search-replace em IDE para dividir:
# - actions.ts → companies.ts, certificates.ts, audit.ts
# - auth-actions.ts → server/auth.ts

# Phase 4: Atualizar imports (1h)
# Usar Find and Replace no editor:
# FROM: from "./audit-logs"
# TO:   from "@/components/audit/AuditLogsTable"
# 
# Repetir para todos 8 componentes

# Phase 5: Testar (1h)
npm run dev
# Testar:
# - Login/logout
# - Criar empresa
# - Ver documentos
# - Sincronizar

# Phase 6: Limpeza (15 min)
# Remover arquivos antigos .tsx de src/app/
# Verificar zero referências
```

**Sucesso**: App funciona, page.tsx tem 300 linhas (não 1000+) ✅

---

## 📊 CHECKLIST DE VALIDAÇÃO

Após cada bloco, validar:

### PostgreSQL ✅
- [ ] `docker-compose up -d` sem erros
- [ ] `docker ps` mostra container `healthy`
- [ ] App carrega http://localhost:4000
- [ ] Criar empresa salva em PostgreSQL (not SQLite)
- [ ] `docker-compose down` sem data loss

### Logging ✅
- [ ] `npm install` sucesso
- [ ] `npm run dev` sem erros
- [ ] Fazer login → Ver JSON logs no console
- [ ] Logs têm: timestamp, module, message, nível

### Queries ✅
- [ ] page.tsx importa `getHomePageData`
- [ ] Home page carrega
- [ ] Network DevTools mostra 5 queries (antes 6)
- [ ] Page load time reduzido

### Pastas ✅
- [ ] Todos 8 componentes movidos
- [ ] Todos imports atualizados
- [ ] Não há referências a arquivos antigos
- [ ] `npm run dev` sem erros
- [ ] Navegação completa funciona
- [ ] Remover `.tsx` antigos (audit-logs, certificate-company-form, etc)

---

## 📁 DEPENDÊNCIAS ENTRE BLOCOS

```
PostgreSQL (BLOCO 1)
    ↓
    ├─→ Logging (BLOCO 2) - independente
    ├─→ Queries (BLOCO 3) - independente  
    └─→ Pastas (BLOCO 4) - depende de Query estar integrada
```

**Pode fazer em paralelo**: BLOCO 1 + (BLOCO 2, 3, 4)

**Sequência recomendada**:
1. PostgreSQL (pronto pra usar)
2. Logging + Queries (simples, sem dependências)
3. Pastas (maior refactor, requer tudo pronto)

---

## 🎯 TEMPO ESTIMADO

| Bloco | Tempo | Complexidade |
|-------|-------|--------------|
| 1. PostgreSQL | 15-30 min | 🟢 Fácil |
| 2. Logging | 45-60 min | 🟡 Média |
| 3. Queries | 30-45 min | 🟡 Média |
| 4. Pastas | 2-3 horas | 🟠 Difícil |
| **Total** | **4-5 horas** | **Média** |

**Se 2 devs em paralelo**: 2-3 horas

---

## 🚨 COMMON PITFALLS

| Problema | Solução |
|----------|---------|
| "Module not found" | Update all imports, check 3-4 times |
| "Database error" | Check `DATABASE_URL` env var set |
| "App doesn't load" | Run `npm install` if added pino |
| "Queries still 6" | Verify `getHomePageData` importado em page.tsx |
| "TypeScript errors" | Run `npm run build` para ver todos erros |

---

## ✨ DEPOIS DE TUDO

```
✅ PostgreSQL rodando em produção
✅ Logging estruturado em 3+ endpoints
✅ Queries 50% mais rápidas
✅ Código organizado por domínio
✅ page.tsx desceu de 1000 → 300 linhas
✅ Pronto pra escalar
```

---

## 📞 DÚVIDAS?

1. **PostgreSQL não sobe?** → Check Docker, check ports 54329
2. **Imports quebrados?** → Use Find/Replace, 1 arquivo de cada vez
3. **Logging não aparece?** → Run `npm install` e reinicie dev server
4. **TypeScript errors?** → Run `npm run build` para diagnóstico completo

---

## 🎬 COMEÇAR AGORA

```bash
cd C:\Users\mlisb\OneDrive\ProjetosAntigravy\Logos_NF_NFS\portal-fiscal

# Bloco 1: PostgreSQL
docker-compose up -d
npx prisma migrate dev
npm run dev

# → Ir para BLOCO 2 quando home page carregar
```

---

**Status**: 🟢 PRONTO PARA COMEÇAR  
**Última atualização**: 2026-09-01  
**Estimativa conclusão**: Hoje em ~5 horas OU amanhã em 2 horas (paralelo)

Let's go! 🚀
