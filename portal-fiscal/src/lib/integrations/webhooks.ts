import "server-only";
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

export function generateWebhookSignature(secret: string, timestamp: number, payload: string): string {
  const signaturePayload = `${timestamp}.${payload}`;
  const hmac = createHmac("sha256", secret).update(signaturePayload).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

export type DispatchWebhookInput = {
  organizationId: string;
  event: string;
  payload: any;
};

export async function dispatchWebhookEvent(input: DispatchWebhookInput) {
  const endpoints = await db.webhookEndpoint.findMany({
    where: {
      organizationId: input.organizationId,
      active: true,
    },
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify({
    event: input.event,
    timestamp,
    data: input.payload,
  });

  const results = [];

  for (const endpoint of endpoints) {
    const eventList = typeof endpoint.events === "string" ? endpoint.events.split(",") : (endpoint.events || []);
    if (eventList.length && !eventList.includes(input.event) && !eventList.includes("*")) {
      continue;
    }

    const signature = generateWebhookSignature(endpoint.secret, timestamp, payloadString);
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let status = "DELIVERED";

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FiscalBox-Signature": signature,
          "User-Agent": "FiscalBox-Webhook/1.0",
        },
        body: payloadString,
      });

      statusCode = response.status;
      responseBody = (await response.text()).slice(0, 1000);

      if (!response.ok) {
        status = "FAILED";
      }
    } catch (error: any) {
      status = "FAILED";
      responseBody = error.message || "Erro de conexão no endpoint do Webhook.";
    }

    const delivery = await db.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event: input.event,
        payload: JSON.stringify(input.payload),
        statusCode,
        responseBody,
        status,
      },
    });

    results.push(delivery);
  }

  return results;
}
