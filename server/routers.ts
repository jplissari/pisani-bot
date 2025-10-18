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
      .mutation(async ({ input }) => {
        // Save user message
        const userMessage = await db.createMessage({
          id: randomUUID(),
          conversationId: input.conversationId,
          role: "user",
          content: input.content,
        });

        // Get conversation history
        const history = await db.getMessagesByConversationId(input.conversationId);
        
        // Prepare messages for OpenAI
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: "system",
            content: "Você é um assistente útil e amigável. Responda em português brasileiro.",
          },
          ...history.map((msg) => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
          })),
        ];

        // Call OpenAI API
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
});

export type AppRouter = typeof appRouter;
