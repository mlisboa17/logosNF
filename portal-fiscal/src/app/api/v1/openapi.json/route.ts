import { NextResponse } from "next/server";

export async function GET() {
  const openApiSpec = {
    openapi: "3.0.3",
    info: {
      title: "FiscalBox Public API",
      version: "1.0.0",
      description: "API pública v1 para integração de documentos fiscais (NF-e, NFS-e) e sincronização com ERPs.",
    },
    servers: [
      {
        url: "http://localhost:3000/api/v1",
        description: "Servidor local de desenvolvimento",
      },
    ],
    security: [
      {
        BearerAuth: [],
      },
    ],
    paths: {
      "/documents": {
        get: {
          summary: "Lista documentos fiscais em formato JSON normalizado",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "companyId", in: "query", schema: { type: "string" } },
            { name: "kind", in: "query", schema: { type: "string", enum: ["NFE", "NFSE", "NFE_EVENT", "NFSE_EVENT"] } },
            { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            "200": { description: "Lista de documentos capturados" },
            "401": { description: "API Key inválida ou sem escopo" },
          },
        },
      },
      "/documents/{id}": {
        get: {
          summary: "Obtém o JSON normalizado de um documento por ID",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Detalhes do documento" },
            "404": { description: "Documento não encontrado" },
          },
        },
      },
      "/webhooks/test": {
        post: {
          summary: "Dispara evento de teste para os webhooks ativos da organização",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Resultados da entrega dos webhooks" },
          },
        },
      },
      "/erp/integration-status": {
        post: {
          summary: "Atualiza o status de integração do documento no ERP",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["documentId", "status"],
                  properties: {
                    documentId: { type: "string" },
                    status: { type: "string", enum: ["ACCEPTED", "ERROR", "REPROCESSED", "QUEUED"] },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Status atualizado com sucesso" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "ApiKey",
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}
