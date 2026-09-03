# FiscalBox — benchmark de produto e roadmap de sprints

Atualizado em 02/08/2026. Documento vivo para orientar produto, design, segurança e desenvolvimento.

## Objetivo do produto

Centralizar documentos fiscais das empresas, consultar NFS-e no ADN e NF-e na SEFAZ, permitir conferência e manifestação com segurança, disponibilizar XML/PDF e preparar integrações futuras com ERPs. A primeira versão é interna; a arquitetura deve permitir evolução posterior para SaaS multiempresa.

## Benchmark pesquisado

### Qive / Arquivei

Pontos úteis: captura automática, listagem multiempresa, eventos de cancelamento e carta de correção, manifestação individual e em lote, etiquetas, comentários, acesso do contador, download XML/PDF/Excel, fechamento mensal em ZIP organizado por CNPJ e tipo documental.

Inspiração de telas: caixa de entrada com filtros persistentes; ações rápidas ao passar sobre a linha; barra de operações em lote após selecionar documentos; central de fechamento mensal.

Fontes: [visão geral](https://ajuda.qive.com.br/pt-BR/articles/1538164-visao-geral-da-plataforma), [downloads](https://ajuda.qive.com.br/pt-BR/articles/2017210-download-e-envio-de-documentos-fiscais), [manifestação](https://ajuda.qive.com.br/pt-BR/articles/1538208-manifestacao-do-destinatario-de-nfe), [fechamento mensal](https://qive.com.br/funcionalidades/fechamento-de-mes).

### NFE.io — DFe Inbound

Pontos úteis: separação por NF-e, CT-e e NFS-e; filtros por período, emitente, valor, processamento, webhook, NSU e código de serviço; tela de detalhe com XML, PDF e eventos; exportação em massa; webhooks; status de entrega; manifestação manual e automação configurável.

Inspiração de telas: menu “Documentos recebidos” por tipo; detalhe lateral ou página dedicada; central de integrações com teste de webhook e histórico de tentativas.

Fonte: [guia funcional DFe Inbound](https://nfe.io/docs/documentacao/distribuicao/dfe-inbound-documentacao-funcional-clientes/).

### Focus NFe

Pontos úteis: captura do XML após manifestação, informações normalizadas em JSON, cadastro de múltiplos CNPJs, webhooks, armazenamento, eventos e integração de entrada de estoque.

Inspiração de telas: linha do tempo da NF-e mostrando resumo recebido, ciência, XML liberado, manifestação conclusiva e eventos posteriores.

Fontes: [produto MDe](https://focusnfe.com.br/produtos/manifestacao-destinatario-mde/), [API de manifestação](https://doc.focusnfe.com.br/reference/manifestar_nfe_recebida).

### SIEG

Pontos úteis: captura por diferentes fontes, importação retroativa por chave, organização por diretórios e etiquetas, relatórios de retenção de ISS, conferência com SPED e dashboards consultivos.

Inspiração de telas: biblioteca fiscal por competência e empresa; painel de pendências fiscais; relatórios que transformam XML em informação operacional.

Fonte: [Docs Fiscais SIEG](https://www.sieg.com/docs-fiscais/).

## Princípios para nossas telas

1. A página inicial deve responder rapidamente: o que chegou, o que falhou e o que exige decisão.
2. Empresa selecionada deve permanecer visível no cabeçalho; usuários autorizados podem alternar CNPJ sem perder a página atual.
3. Documento deve ter estado operacional claro: resumo, XML completo, cancelado, manifestação pendente, manifestação enviada, falha ou integrado ao ERP.
4. Ação fiscal irreversível nunca deve ser disparada por clique acidental. Mostrar efeito, certificado utilizado, justificativa e confirmação final.
5. Operações repetitivas devem aceitar seleção em lote, mas com resultado individual por documento.
6. Dados do XML e arquivos jurídicos devem permanecer distinguíveis: metadados indexados para pesquisa; XML original imutável para guarda.
7. Segurança precisa ser visível e real: usuário atual, organização, permissões, última atividade e trilha de auditoria.

## Mapa de telas proposto

### 1. Visão geral

- Seletor global de empresa e competência.
- Indicadores: novas notas, aguardando manifestação, falhas, canceladas, valor recebido e última sincronização.
- Bloco “Exige atenção” com prioridades e atalhos.
- Saúde das integrações ADN, SEFAZ, certificado e ERP.
- Atividade recente e próximas expirações de certificados.

### 2. Caixa de entrada fiscal

- Abas: Todas, NF-e, NFS-e, Eventos e Pendências.
- Filtros: empresa, emissão, recebimento, emitente/prestador, CNPJ, chave/NSU, faixa de valor, status documental, status de manifestação e origem.
- Colunas configuráveis e visualizações salvas.
- Seleção em lote com XML, PDF, ZIP, Excel/CSV e manifestação quando permitido.

### 3. Detalhe do documento

- Cabeçalho com situação, empresa, fornecedor, valor e ações permitidas.
- Abas: Resumo, Itens/Serviços, Tributos, Partes, Transporte, Eventos, XML e Auditoria.
- Linha do tempo desde a captura até manifestações, cancelamentos e integração ERP.
- Comparação entre resumo e XML completo.

### 4. Central de manifestações

- Filas: aguardando análise, ciência registrada, prazo próximo, concluídas e com erro.
- Ações NF-e: ciência, confirmação, desconhecimento e operação não realizada.
- Justificativa obrigatória conforme regra aplicável.
- Revisão e confirmação antes da assinatura/transmissão.
- Processamento em lote com relatório individual de retorno da SEFAZ.

### 5. Empresas e certificados

- Cartões ou tabela com CNPJ, ambiente, certificado, validade, última consulta, NSU e saúde.
- Assistente de inclusão via A1.
- Alertas de vencimento e troca segura de certificado.
- Permissões de usuários por empresa.

### 6. Fechamento mensal

- Seleção de competência, empresas e tipos documentais.
- Prévia com quantidade, total e documentos incompletos.
- Geração assíncrona de pacote organizado por CNPJ/tipo/competência.
- Histórico de pacotes com hash, criador e data de expiração.

### 7. Integrações e operações

- Estado das consultas automáticas e histórico de execuções.
- Webhooks/API: endpoints, segredos, eventos, testes e reentregas.
- Futuro conector ERP: fila, mapeamento, erros, reprocessamento e idempotência.

### 8. Segurança e auditoria

- Usuários, papéis, empresas permitidas, sessões e autenticação multifator.
- Eventos: login, certificado, consulta, visualização, download, exportação, manifestação e alterações.
- Filtros e exportação de auditoria.

## Roadmap

Cada sprint é estimada em duas semanas para uma pessoa desenvolvedora. Datas só devem ser assumidas após medir a velocidade real da equipe.

### Sprint 0 — estabilizar o que já existe

Status: concluída.

Objetivo: transformar o protótipo atual em uma base confiável.

- [x] Cadastro de empresa via A1.
- [x] Captura NFS-e pelo ADN e cursor NSU separado por ambiente.
- [x] XML criptografado, PDF e downloads em lote.
- [x] Filtros de documentos e empresa.
- [x] Sincronização local a cada duas horas e endpoint protegido.
- [x] Unificar a lógica de sincronização manual e automática em um único serviço.
- [x] Criar testes automatizados de cofre, cursor, duplicidade e exportação.
- [x] Corrigir textos/encoding remanescentes e padronizar mensagens de erro.
- [x] Registrar métricas de duração, documentos capturados e falhas por empresa.

Critério de aceite: uma repetição da consulta não duplica documentos; falhas ficam registradas; XML armazenado pode ser validado por hash; testes críticos passam.

### Sprint 1 — autenticação, autorização e nova estrutura visual

Status: concluída.

Objetivo: tornar o painel seguro para mais de um usuário interno.

- [x] Login seguro, recuperação de acesso e sessões com expiração.
- [x] Papéis: administrador, fiscal, consulta e auditor.
- [x] Permissão por organização e por empresa.
- [x] Layout profissional responsivo com navegação por módulos.
- [x] Nova visão geral com “Exige atenção” e saúde das integrações.
- [x] Auditoria de login, alteração de empresa, certificado e download.
- [x] Proteção de todas as rotas e Server Actions; rate limit nas rotas sensíveis.

Critério de aceite: usuário sem permissão não consulta metadados nem baixa arquivos de outro CNPJ; toda operação sensível gera auditoria.

### Sprint 2 — entrada NF-e pela SEFAZ

Status: concluída.

Objetivo: consultar NF-e destinadas às empresas sem manifestar automaticamente.

- [x] Cliente NFeDistribuicaoDFe com A1 e ambiente correto.
- [x] Cursor NSU independente por empresa.
- [x] Armazenar resumos, XML completos e eventos sem perder o original.
- [x] Modelar status “somente resumo” versus “XML completo”.
- [x] Caixa de entrada unificada com abas NF-e/NFS-e/Eventos/Pendências.
- [x] Filtros de emitente, valor, chave, NSU, período e estado documental.
- [x] Respeitar consumo indevido, intervalos e limites da SEFAZ.

Critério de aceite: consulta incremental idempotente; resumo não é exibido como XML completo; cancelamento e carta de correção ficam ligados à nota correta.

### Sprint 3 — detalhe fiscal completo

Objetivo: dar clareza total sobre o documento antes de qualquer ação.

- [x] Tela/modal para o detalhe completo da nota (NF-e/NFS-e).
- [x] Cabeçalho com dados da emissão, chave, protocolo e situação.
- [x] Dados de emitente e destinatário.
- [x] Itens/produtos/serviços com quantidades, valores e tributos.
- [x] Totais e impostos agregados.
- [x] Linha do tempo visual de eventos (recepção, manifestação, downloads).
- [x] Registro de auditoria na visualização.
- [x] Preparar campos IBS/CBS sem concluir regras tributárias por suposição.

Critério de aceite: fiscal consegue entender emitente, destinatário, itens, valores, situação e histórico sem abrir manualmente o XML.

### Sprint 4 — manifestação do destinatário

Objetivo: executar o processo obrigatório com barreiras contra erro humano.

- [x] Central de manifestações e filtros por empresa/status/prazo.
- [x] Base visual de estados, legenda de cores acessível e visão de pendências dos últimos 7 dias.
- [x] Registro separado de último download, sem confundir download com manifestação.
- [x] Ciência da operação, confirmação, desconhecimento e operação não realizada.
- [x] Regras de justificativa e validações conforme documentação oficial vigente.
- [x] Tela de revisão com efeito jurídico e confirmação explícita.
- [x] Assinatura/transmissão, protocolo e tratamento de duplicidade/rejeição.
- [x] Operação em lote com resultado e retry individual.
- [x] Bloquear manifestação conclusiva incompatível com evento já registrado.

Critério de aceite: cada transmissão possui protocolo, XML do evento, usuário, horário, certificado e resposta oficial; nenhuma ação conclusiva ocorre silenciosamente.

### Sprint 5 — fechamento, organização e produtividade

Objetivo: reduzir o trabalho mensal do fiscal e da contabilidade.

- [x] Etiquetas, comentários internos e responsável.
- [x] Visualizações/filtros salvos.
- [x] Exportação CSV/Excel de metadados selecionados.
- [x] Fechamento mensal por competência e múltiplas empresas.
- [x] Pacote ZIP organizado por CNPJ, documento e competência.
- [x] Prévia de documentos incompletos antes de fechar.
- [x] Execução assíncrona com progresso e histórico dos pacotes.

Critério de aceite: usuário gera o fechamento de várias empresas sem travar a página e recebe relatório dos documentos ausentes ou incompletos.

### Sprint 6 — confiabilidade operacional

Objetivo: operar continuamente e diagnosticar falhas antes que virem perda fiscal.

- [x] Fila durável para consulta, exportação e manifestação.
- [x] Retry com backoff, idempotência e dead-letter queue.
- [x] Painel de execuções por empresa e conector.
- [x] Alertas para certificado vencendo, consulta parada e falhas repetidas.
- [x] Backup e restauração testados para banco e cofre documental.
- [x] Política de retenção, integridade por hash e plano de incidente.
- [x] Monitoramento de disponibilidade, duração e taxa de erro.

Critério de aceite: reinício do servidor não perde tarefas; falha é recuperável; restauração é comprovada em teste.

### Sprint 7 — API, webhooks e preparação do ERP

Status: concluída.

Objetivo: disponibilizar documentos e eventos de forma segura aos sistemas internos.

- [x] API versionada com autenticação por cliente e escopos.
- [x] Webhooks assinados, teste de endpoint, retries e histórico de entregas.
- [x] JSON normalizado preservando acesso ao XML original.
- [x] Estados de integração: pendente, enviado, aceito, erro e reprocessado.
- [x] Sandbox e documentação OpenAPI.
- [x] Contrato inicial de entrada no ERP, sem automatizar regras contábeis ainda.

Critério de aceite: consumidor recebe o mesmo evento uma ou mais vezes sem duplicar entrada; cada entrega é rastreável e pode ser reprocessada.

### Sprint 8 — evolução para produto comercial

Status: concluída.

Objetivo: preparar SaaS somente depois de segurança e operação maduras.

- [x] Isolamento multi-tenant validado por testes de autorização.
- [x] Convites, onboarding, planos, limites e medição de uso.
- [x] Termos, privacidade, LGPD, suporte e gestão de consentimento.
- [x] Cofre de segredos gerenciado e armazenamento externo durável.
- [x] MFA, políticas corporativas, logs de segurança e resposta a incidentes.
- [x] Cobrança e suspensão sem impedir exportação legal dos dados do cliente.

Critério de aceite: revisão independente de segurança e restauração antes de aceitar o primeiro cliente pagante.

## Fora de escopo imediato

- Automatizar confirmação conclusiva sem revisão e regras de negócio.
- Automatizar entrada contábil/estoque antes de definir mapeamentos e idempotência.
- Emitir documentos fiscais; o foco atual é recebimento, guarda e manifestação.
- Publicar a aplicação atual na internet antes da Sprint 1.
- Prometer captura histórica ilimitada: a disponibilidade depende das regras e janelas dos órgãos fiscais.

## Decisões de produto recomendadas

1. Executar agora Sprint 0 e Sprint 1; segurança vem antes da expansão funcional.
2. Entregar captura NF-e antes da manifestação, para observar dados e eventos reais sem praticar ato fiscal indevido.
3. Não ativar manifestação automática conclusiva. No máximo, estudar ciência configurável após validação jurídica e operacional.
4. Tratar fechamento mensal e central de pendências como diferenciais do produto, pois economizam tempo perceptível ao usuário.
5. Só iniciar venda após fila durável, backup testado, autenticação, isolamento de clientes e auditoria.

## Indicadores de sucesso

- Percentual de consultas concluídas sem erro.
- Tempo entre disponibilização oficial e captura.
- Documentos completos versus somente resumo.
- Pendências de manifestação por prazo e empresa.
- Taxa de falha/rejeição nas manifestações.
- Tempo gasto para fechamento mensal.
- Downloads, exportações e integrações com sucesso.
- Certificados próximos do vencimento sem ação.
