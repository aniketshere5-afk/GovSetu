import { and, desc, eq, isNull } from "drizzle-orm";
import { notifications } from "../drizzle/schema";
import { getDb } from "./db";

/** In-app notification. Email/SMS delivery is a future adapter behind this call. */
export async function notifyUser(input: {
  userId: number;
  applicationId?: number | null;
  type: string;
  title: string;
  body?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({
    userId: input.userId,
    applicationId: input.applicationId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
  });
}

export async function listNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function markNotificationRead(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)));
}
