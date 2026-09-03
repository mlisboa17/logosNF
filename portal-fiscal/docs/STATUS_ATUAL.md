# FiscalBox — ponto de retomada

Atualizado em 07/08/2026.

## Estado atual

- Painel local em `http://127.0.0.1:4000`.
- PostgreSQL em Docker com migrations aplicadas.
- Autenticação, sessão de 8 horas e autorização por organização/papel.
- Duas empresas cadastradas com certificados A1.
- Consulta NFS-e pelo ADN, cursor NSU e execução automática a cada 2 horas.
- XML criptografado, DANFSe/PDF e exportações em lote.
- Painel operacional com alertas, saúde dos conectores e filtro global por empresa.
- Lista com filtros, seleção em lote, legenda de cores e estados documentais.
- Registro separado de download e manifestação.
- Visão preparada para NF-e pendentes dos últimos 7 dias.
- NFS-e atuais aparecem como `Não se aplica` para manifestação de NF-e.

## Últimas validações

- Migration `20260802205605_add_document_operational_status` aplicada.
- Prisma Client regenerado.
- ESLint aprovado.
- 4 testes automatizados aprovados.
- Build de produção aprovado.
- Interface verificada sem erros de console.

## Próxima etapa recomendada

1. Implementar auditoria de login, downloads e alterações.
2. Adicionar limitação de tentativas de login e recuperação segura de acesso.
3. Criar administração de usuários e permissões.
4. Iniciar o conector `NFeDistribuicaoDFe` da SEFAZ.
5. Alimentar os estados reais de manifestação e a central de pendências.

## Observação importante

A pasta ainda não possui repositório Git. Antes de uma evolução maior, é recomendado inicializar o Git e criar o primeiro commit de checkpoint, preservando `.env`, `.vault`, logs e certificados fora do versionamento.
