import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { randomUUID } from "crypto";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  chat: router({
    // Get all conversations for the current user
    getConversations: protectedProcedure.query(async ({ ctx }) => {
      return await db.getConversationsByUserId(ctx.user.id);
    }),

    // Create a new conversation
    createConversation: protectedProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const conversationId = randomUUID();
        return await db.createConversation({
          id: conversationId,
          userId: ctx.user.id,
          title: input.title || "Nova Conversa",
        });
      }),

    // Get messages for a conversation
    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(async ({ input }) => {
        return await db.getMessagesByConversationId(input.conversationId);
      }),

    // Send a message and get AI response
    sendMessage: protectedProcedure
      .input(
        z.object({
          conversationId: z.string(),
          content: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          // Save user message
          const userMessage = await db.createMessage({
            id: randomUUID(),
            conversationId: input.conversationId,
            role: "user",
            content: input.content,
          });

          // Get conversation history
          const history = await db.getMessagesByConversationId(input.conversationId);
          
          // Get active documents and system contexts for the user
          const userDocuments = await db.getActiveDocumentsByUserId(ctx.user.id);
          const userSystemContexts = await db.getActiveSystemContextsByUserId(ctx.user.id);
          
          // Build system prompt with documents and contexts
          let systemPrompt = "Você é um assistente útil e amigável. Responda em português brasileiro.";
          
          // Add system contexts
          if (userSystemContexts.length > 0) {
            systemPrompt += "\n\n## Instruções Especiais:\n";
            userSystemContexts.forEach((context) => {
              systemPrompt += `\n${context.instructions}`;
            });
          }
          
          // Add documents as context
          if (userDocuments.length > 0) {
            systemPrompt += "\n\n## Documentos de Referência:\n";
            userDocuments.forEach((doc) => {
              systemPrompt += `\n### ${doc.title}\n${doc.content}\n`;
            });
          }
          
          // Prepare messages for OpenAI
          const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            {
              role: "system",
              content: systemPrompt,
            },
            ...history.map((msg) => ({
              role: msg.role as "user" | "assistant" | "system",
              content: msg.content,
            })),
          ];

          // Call OpenAI API
          console.log("[Chat] Calling OpenAI API...");
          const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages,
          });

          const assistantContent = completion.choices[0].message.content || "Desculpe, não consegui gerar uma resposta.";

          // Save assistant message
          const assistantMessage = await db.createMessage({
            id: randomUUID(),
            conversationId: input.conversationId,
            role: "assistant",
            content: assistantContent,
          });

          // Update conversation timestamp
          await db.updateConversation(input.conversationId, {
            updatedAt: new Date(),
          });

          return {
            userMessage,
            assistantMessage,
          };
        } catch (error) {
          console.error("[Chat] Error in sendMessage:", error);
          throw error;
        }
      }),

    // Delete a conversation
    deleteConversation: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteConversation(input.conversationId);
        return { success: true };
      }),

    // Update conversation title
    updateConversationTitle: protectedProcedure
      .input(z.object({ conversationId: z.string(), title: z.string() }))
      .mutation(async ({ input }) => {
        await db.updateConversation(input.conversationId, {
          title: input.title,
        });
        return { success: true };
      }),
  }),

  documents: router({
    // Get all documents for the current user
    getDocuments: protectedProcedure.query(async ({ ctx }) => {
      return await db.getDocumentsByUserId(ctx.user.id);
    }),

    // Create a new document
    createDocument: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          content: z.string(),
          fileUrl: z.string().optional(),
          fileName: z.string().optional(),
          mimeType: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await db.createDocument({
          id: randomUUID(),
          userId: ctx.user.id,
          title: input.title,
          content: input.content,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          mimeType: input.mimeType,
          isActive: "true",
        });
      }),

    // Update a document
    updateDocument: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().optional(),
          content: z.string().optional(),
          isActive: z.enum(["true", "false"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateDocument(input.id, {
          title: input.title,
          content: input.content,
          isActive: input.isActive,
        });
        return { success: true };
      }),

    // Delete a document
    deleteDocument: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteDocument(input.id);
        return { success: true };
      }),
  }),

  systemContext: router({
    // Get all system contexts for the current user
    getContexts: protectedProcedure.query(async ({ ctx }) => {
      return await db.getSystemContextsByUserId(ctx.user.id);
    }),

    // Create a new system context
    createContext: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          instructions: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await db.createSystemContext({
          id: randomUUID(),
          userId: ctx.user.id,
          title: input.title,
          instructions: input.instructions,
          isActive: "true",
        });
      }),

    // Update a system context
    updateContext: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().optional(),
          instructions: z.string().optional(),
          isActive: z.enum(["true", "false"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateSystemContext(input.id, {
          title: input.title,
          instructions: input.instructions,
          isActive: input.isActive,
        });
        return { success: true };
      }),

    // Delete a system context
    deleteContext: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteSystemContext(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
