# Conector ADN

O conector usa `open-nfse` (MIT) para mTLS com certificado A1 e distribuição incremental pela rota oficial `GET /DFe/{NSU}`.

Regras de operação:

- iniciar em Produção Restrita;
- manter um cursor NSU separado por empresa e origem;
- persistir documentos e o novo cursor na mesma transação;
- nunca avançar o cursor antes de armazenar todos os XMLs do lote;
- respeitar respostas 429 e não executar sincronizações concorrentes para o mesmo CNPJ;
- carregar PFX e senha somente a partir do cofre de segredos;
- apagar buffers do certificado da memória assim que a chamada terminar.
