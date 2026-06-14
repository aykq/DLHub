import { db } from "@/db";
import { notifications } from "@/db/schema";

export async function createNotification(
  type: string,
  message: string,
  userId?: string
): Promise<void> {
  await db.insert(notifications).values({
    type,
    message,
    userId: userId ?? null,
  });
}

// SSE clients registry — in-memory, sadece admin için
const sseClients = new Set<ReadableStreamDefaultController>();

export function addSseClient(controller: ReadableStreamDefaultController) {
  sseClients.add(controller);
}

export function removeSseClient(controller: ReadableStreamDefaultController) {
  sseClients.delete(controller);
}

export function broadcastNotification(data: object) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const controller of sseClients) {
    try {
      controller.enqueue(new TextEncoder().encode(payload));
    } catch {
      sseClients.delete(controller);
    }
  }
}
