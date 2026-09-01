# 🎯 Próximos Passos - LOGOS

## ⚡ Ação Imediata (Hoje - Antes de Commit)

### 1. Testar PostgreSQL Localmente
```bash
cd portal-fiscal

# Opção 1: Com Docker Compose
docker-compose up -d
export DATABASE_URL="postgresql://fiscalbox_app:troque-esta-senha@127.0.0.1:5432/fiscalbox"
npx prisma migrate dev

# Opção 2: PostgreSQL Local
psql -U postgres
CREATE DATABASE fiscalbox;
CREATE USER fiscalbox_app WITH PASSWORD 'senha';
GRANT ALL PRIVILEGES ON DATABASE fiscalbox TO fiscalbox_app;

# Depois execute:
npx prisma migrate dev
```

### 2. Testar Rate Limiting
```bash
# Terminal 1
npm run dev

# Terminal 2: Teste endpoint de sync
# Faça 11 requests rapidamente
for i in {1..11}; do
  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:4000/api/cron/sync-fiscal
  echo "Request $i"
  sleep 0.1
done

# Esperado: 11º request retorna 429 com X-RateLimit-Remaining: 0
```

### 3. Testar Validação CNPJ
- Abra http://localhost:4000/login
- Vá para seção "Adicionar empresa"
- Teste inputs:
  - `00000000000000` → Erro "CNPJ inválido (dígitos verificadores)"
  - `11111111111111` → Erro "CNPJ inválido (sequência repetida)"
  - `34.028.314/0001-76` → ✅ Válido (GOOGLE)
  - `11.222.333/0001-81` → ✅ Válido (FAKE mas válido)

---

## 📋 Fase 2: Importantes (Prioridade)

### 🟠 #6: Reestruturar Pastas (Arquitetura)
**Status**: 🔄 Planejado  
**Tempo Estimado**: 3 horas  
**Objetivo**: Escalabilidade

```
ANTES:
src/app/
├── page.tsx (1000+ linhas)
├── actions.ts (200+ linhas)
├── audit-logs.tsx
├── certificate-company-form.tsx
├── company-scope-selector.tsx
├── document-detail-modal.tsx
├── documents-table.tsx
├── users-management.tsx
└── ... 10+ mais arquivos

DEPOIS:
src/
├── app/                    # Rotas Next.js apenas
│   ├── api/
│   ├── (auth)/
│   ├── layout.tsx
│   └── page.tsx (refatorado)
├── components/             # Componentes React
│   ├── documents/
│   │   ├── DocumentsTable.tsx
│   │   └── DocumentDetailModal.tsx
│   ├── companies/
│   │   ├── CompanyForm.tsx
│   │   ├── CompanyScopeSelector.tsx
│   │   └── SyncButton.tsx
│   ├── users/
│   │   └── UsersManagement.tsx
│   ├── audit/
│   │   └── AuditLogsTable.tsx
│   └── shared/
│       ├── CnpjInput.tsx
│       └── Icons.tsx
├── server/                 # Server Actions
│   ├── companies.ts
│   ├── documents.ts
│   ├── auth.ts
│   └── audit.ts
└── lib/
    ├── auth/
    ├── fiscal/
    ├── security/
    ├── db.ts
    └── utils/
```

**Subtarefas**:
1. Criar pastas de destino
2. Mover componentes com busca-e-replace de imports
3. Mover server actions para `src/server/`
4. Refatorar `src/app/page.tsx` para 200 linhas (separar em componentes)
5. Atualizar imports em todos os arquivos
6. Testar navegação completa

---

### 🟠 #7: API Response Wrapper
**Status**: 🔄 Planejado  
**Tempo Estimado**: 2 horas  
**Objetivo**: Consistência de API

```typescript
// src/lib/api/response.ts (NOVO)

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    version: string;
    requestId?: string;
  };
};

export function success<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), version: "v1", ...meta },
  };
}

export function error(code: string, message: string, details?: unknown): ApiResponse {
  return {
    success: false,
    error: { code, message, details },
    meta: { timestamp: new Date().toISOString(), version: "v1" },
  };
}
```

**Aplicar em todos os endpoints `/api/`**:
```typescript
// ANTES
export async function GET() {
  return Response.json({ id: "123", name: "Test" });
}

// DEPOIS
import { success, error } from "@/lib/api/response";
export async function GET() {
  return Response.json(success({ id: "123", name: "Test" }));
}
```

---

### 🟠 #8: Logging Estruturado
**Status**: 🔄 Planejado  
**Tempo Estimado**: 2 horas  
**Objetivo**: Observabilidade

```typescript
// src/lib/logging.ts (NOVO)

import pino from "pino";

export const logger = pino(
  process.env.NODE_ENV === "production"
    ? undefined
    : { transport: { target: "pino-pretty", options: { colorize: true } } }
);

// Usar em qualquer lugar:
logger.info({ companyId: "123" }, "Sincronização iniciada");
logger.error({ error: new Error("...") }, "Falha na sincronização");
```

**Aplicar em**:
- Integrações com ADN/SEFAZ
- Operações de certificado
- Sincronizações
- Operações críticas

---

### 🟠 #9: Tratamento de Erros Global
**Status**: 🔄 Planejado  
**Tempo Estimado**: 2 horas  
**Objetivo**: Respostas consistentes

```typescript
// src/lib/errors.ts (NOVO)

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number = 500,
    message?: string
  ) {
    super(message || code);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", 400, message);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super("NOT_FOUND", 404, `${entity} não encontrado`);
  }
}

// Usar:
throw new ValidationError("CNPJ inválido");
throw new NotFoundError("Empresa");
```

---

### 🟠 #10: Otimizar Queries N+1
**Exemplo**:
```typescript
// ANTES (N+1)
const companies = await db.company.findMany();
for (const company of companies) {
  const members = await db.user.count({ where: { /* ... */ } });
}

// DEPOIS (1 query)
const companies = await db.company.findMany({
  include: { _count: { select: { users: true } } }
});
```

---

## 🎓 Fase 3: Recomendadas (Próxima Semana)

### 🟡 #11-15:
- [ ] Testes de integração (80%+ cobertura)
- [ ] Documentação de fluxos
- [ ] RBAC granular por ação
- [ ] Health check endpoint
- [ ] Melhorar UX de erros

---

## ✨ Fase 4: Otimizações (Nice-to-Have)

### 🟢 #16-23:
- [ ] Next.js Image component
- [ ] Pagination cursor-based
- [ ] Caching estratégico
- [ ] Monitoramento
- [ ] Analytics
- [ ] Mobile responsividade
- [ ] Tema dark/light
- [ ] Internacionalização (i18n)

---

## 🚀 Como Priorizar

### Se você tem **2 horas**: Faça #6 + #7
### Se você tem **4 horas**: Faça #6 + #7 + #8
### Se você tem **1 dia**: Faça #6-10 completos
### Se você tem **1 semana**: Tudo de Fase 2 + Fase 3

---

## 📞 Checklist Antes de Mergear

- [ ] Todas as mudanças testadas localmente
- [ ] Nenhuma quebra de funcionalidade existente
- [ ] Logs implementados e testados
- [ ] Documentação atualizada em CLAUDE.md
- [ ] PR descrito com "Why, What, How"
- [ ] Aprovação de pelo menos 1 revisor

---

**Próxima revisão agendada para**: Quando Fase 2 for 80% completa

Boa codificação! 🚀
