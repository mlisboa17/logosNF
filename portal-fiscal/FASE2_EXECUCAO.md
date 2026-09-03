# ⚡ FASE 2: PLANO DE EXECUÇÃO

**Data Início**: 2026-09-01  
**Status**: 🔄 EM PROGRESSO  
**Foco**: 4 prioridades críticas

---

## 📋 4 PRIORIDADES FOCUS

### 1️⃣ TESTES LOCAIS POSTGRESQL (1-2 horas)
**Objetivo**: Validar que PostgreSQL funciona perfeitamente

**Checklist**:
- [ ] Verificar se docker-compose.yml existe
- [ ] Subir PostgreSQL com Docker
- [ ] Executar prisma migrate dev
- [ ] Testar queries básicas
- [ ] Comparar performance SQLite vs PostgreSQL
- [ ] Documentar setup

**Arquivo**: `docker-compose.yml` / `.env.local`

---

### 2️⃣ REESTRUTURAÇÃO DE PASTAS (2-3 horas)
**Objetivo**: Escalabilidade - separar componentes, server actions, lib

**Checklist**:
- [ ] Criar nova estrutura de diretórios
- [ ] Mover componentes React
- [ ] Mover server actions
- [ ] Atualizar todos os imports
- [ ] Testar navegação completa
- [ ] Remover arquivos antigos

**Estrutura**: Ver PROXIMO_PASSO.md #6

---

### 3️⃣ LOGGING ESTRUTURADO (2 horas)
**Objetivo**: Observabilidade em produção

**Checklist**:
- [ ] Integrar pino/winston
- [ ] Logger em operações críticas
- [ ] Formato JSON estruturado
- [ ] Testar saída em arquivo
- [ ] Documentar níveis (debug, info, warn, error)

**Arquivo**: `src/lib/logging.ts` (novo)

---

### 4️⃣ OTIMIZAR QUERIES N+1 (1.5 horas)
**Objetivo**: Performance - eliminar queries redundantes

**Checklist**:
- [ ] Auditar page.tsx (linha 30-54)
- [ ] Usar `include` inteligentemente
- [ ] Remover queries desnecessárias
- [ ] Testar com database profiler
- [ ] Medir tempo antes/depois

**Arquivo**: `src/app/page.tsx` (refatorado)

---

## 🎯 EXECUÇÃO HOJE

### Agora (1️⃣): PostgreSQL Setup
```bash
cd portal-fiscal
docker-compose up -d
npx prisma migrate dev
npm run dev
# Testar em http://localhost:4000
```

### Próximas 2h (2️⃣): Estrutura de Pastas
```bash
# Criar estrutura
mkdir -p src/components/documents
mkdir -p src/components/companies
mkdir -p src/components/users
mkdir -p src/components/audit
mkdir -p src/components/shared
mkdir -p src/server

# Mover arquivos...
```

### Depois (3️⃣): Logging
```bash
npm install pino
# Implementar src/lib/logging.ts
```

### Final (4️⃣): Queries
```bash
# Refatorar page.tsx
# Medir performance
```

---

## 📊 MÉTRICAS ESPERADAS

| Métrica | Antes | Depois | Target |
|---------|-------|--------|--------|
| App load time | ~2s | ~1s | 50% ⚡ |
| Queries na home | 6 | 3 | 50% ⚘ |
| Arquivo page.tsx | 1000+ linhas | 300 linhas | Mantenível |
| Logging | Nenhum | Completo | Produção-ready |

---

## ✅ PRONTO PARA INICIAR

Status: 🟢 TUDO PREPARADO  
Próximo Passo: Executar 1️⃣ PostgreSQL setup

Acompanhe no CHECKLIST_IMPLEMENTACAO.md
