# FiscalBox

Central multiempresa para consultar, armazenar e disponibilizar documentos fiscais eletrônicos.

## Escopo inicial

- NFS-e do Ambiente de Dados Nacional (ADN), distribuídas por NSU;
- documentos em que o CNPJ seja prestador, tomador ou intermediário;
- cadastro de várias empresas e vínculo com certificados A1;
- histórico de sincronização, pesquisa e download;
- arquitetura preparada para adicionar NF-e (SEFAZ) e comercialização futura.

## Segurança obrigatória

- O arquivo A1 e sua senha nunca devem ser enviados ao navegador nem salvos em texto aberto.
- Em produção, use cofre de segredos/KMS e criptografia por empresa.
- Não inclua certificados, senhas, XMLs fiscais ou dados reais no Git.
- Registre acessos, downloads e operações com certificados em trilha de auditoria.

## Estrutura prevista

1. Aplicação web Next.js para o painel e API interna.
2. PostgreSQL para empresas, metadados, usuários, NSUs e auditoria.
3. Object storage privado para XML e PDF/DANFSE.
4. Worker agendado para consultar ADN e, futuramente, SEFAZ.
5. Provedor de segredos para certificados e senhas.

## Fundação implementada

- modelo PostgreSQL multiempresa em `prisma/schema.prisma`;
- organizações, usuários, permissões, empresas e auditoria;
- referência segura para certificados, sem PFX ou senha no banco;
- cursores NSU, execuções de sincronização e documentos fiscais idempotentes;
- conector ADN de servidor usando `open-nfse` (MIT), mTLS e certificado A1;
- validação e normalização de CNPJ.

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Próximo marco

Subir o PostgreSQL, aplicar a primeira migração, implementar autenticação/cadastro de empresas e realizar a prova mTLS no ambiente de Produção Restrita do ADN.
"# Updated" 
