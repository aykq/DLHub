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

// Per-user SSE clients — for pending user approval notifications
const userSseClients = new Map<string, Set<ReadableStreamDefaultController>>();

export function addUserSseClient(userId: string, controller: ReadableStreamDefaultController) {
  if (!userSseClients.has(userId)) userSseClients.set(userId, new Set());
  userSseClients.get(userId)!.add(controller);
}

export function removeUserSseClient(userId: string, controller: ReadableStreamDefaultController) {
  userSseClients.get(userId)?.delete(controller);
  if (userSseClients.get(userId)?.size === 0) userSseClients.delete(userId);
}

export function broadcastUserStatus(userId: string, data: object) {
  const clients = userSseClients.get(userId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const controller of clients) {
    try {
      controller.enqueue(new TextEncoder().encode(payload));
    } catch {
      clients.delete(controller);
    }
  }
}
