import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, conversations, messages, InsertConversation, InsertMessage, Conversation, Message, documents, InsertDocument, Document, systemContexts, InsertSystemContext, SystemContext } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = 'admin';
        values.role = 'admin';
        updateSet.role = 'admin';
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Conversation queries
export async function createConversation(data: InsertConversation): Promise<Conversation> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(conversations).values(data);
  const result = await db.select().from(conversations).where(eq(conversations.id, data.id!)).limit(1);
  return result[0];
}

export async function getConversationsByUserId(userId: string): Promise<Conversation[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(conversations.updatedAt);
}

export async function updateConversation(id: string, data: Partial<InsertConversation>): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(conversations).set({ ...data, updatedAt: new Date() }).where(eq(conversations.id, id));
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
}

// Message queries
export async function createMessage(data: InsertMessage): Promise<Message> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(messages).values(data);
  const result = await db.select().from(messages).where(eq(messages.id, data.id!)).limit(1);
  return result[0];
}

export async function getMessagesByConversationId(conversationId: string): Promise<Message[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
}

// Document queries
export async function createDocument(data: InsertDocument): Promise<Document> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(documents).values(data);
  const result = await db.select().from(documents).where(eq(documents.id, data.id!)).limit(1);
  return result[0];
}

export async function getDocumentsByUserId(userId: string): Promise<Document[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(documents).where(eq(documents.userId, userId)).orderBy(documents.createdAt);
}

export async function getActiveDocumentsByUserId(userId: string): Promise<Document[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(documents).where(and(eq(documents.userId, userId), eq(documents.isActive, "true"))).orderBy(documents.createdAt);
}

export async function updateDocument(id: string, data: Partial<InsertDocument>): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(documents).set({ ...data, updatedAt: new Date() }).where(eq(documents.id, id));
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(documents).where(eq(documents.id, id));
}

// System Context queries
export async function createSystemContext(data: InsertSystemContext): Promise<SystemContext> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(systemContexts).values(data);
  const result = await db.select().from(systemContexts).where(eq(systemContexts.id, data.id!)).limit(1);
  return result[0];
}

export async function getSystemContextsByUserId(userId: string): Promise<SystemContext[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(systemContexts).where(eq(systemContexts.userId, userId)).orderBy(systemContexts.createdAt);
}

export async function getActiveSystemContextsByUserId(userId: string): Promise<SystemContext[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(systemContexts).where(and(eq(systemContexts.userId, userId), eq(systemContexts.isActive, "true"))).orderBy(systemContexts.createdAt);
}

export async function updateSystemContext(id: string, data: Partial<InsertSystemContext>): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(systemContexts).set({ ...data, updatedAt: new Date() }).where(eq(systemContexts.id, id));
}

export async function deleteSystemContext(id: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(systemContexts).where(eq(systemContexts.id, id));
}
