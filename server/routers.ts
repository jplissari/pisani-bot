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

// Default Pisani context
const DEFAULT_PISANI_CATALOG = `PISANI - SOLUÇÕES EM PLÁSTICO
Website: www.pisani.com.br

SOBRE A PISANI
Há 50 anos entregando qualidade e inovação. A Pisani é uma empresa especializada em soluções plásticas para diversos segmentos da indústria. Com mais de 500 colaboradores, possuímos 3 unidades fabris estrategicamente localizadas.

UNIDADES FABRIS
1. CAXIAS DO SUL - RS
   BR 116, Km 146.3 n° 15602 – São Ciro
   Caxias do Sul - RS - 95059-520
   Telefone: +55 (54) 2101-8700

2. PINDAMONHANGABA - SP
   Tobias Salgado n° 461 Distrito Industrial
   Pindamonhangaba - SP - 12412-770
   Telefone: +55 (12) 3644-2200

3. ABREU E LIMA - PE
   Avenida Ingo Hering n° 01780 Distrito Industrial
   Abreu e Lima - PE - 53540-270
   Telefone: +55 (81) 2123-7300

CAPACIDADE PRODUTIVA
- Produção anual: 36 mil toneladas
- Capacidade de reciclagem: 10.800 toneladas por ano
- 3 moinhos completos para reciclagem

CERTIFICAÇÕES
- ISO 1400:2015 (Gestão Ambiental)
- ISO 9001:2015 (Qualidade)
- IATF 16949:2016 (Indústria Automotiva)

LINHAS DE PRODUTOS
1. CAIXAS PLÁSTICAS - Diversos tamanhos e modelos (ALC, CN, EURO, GALIA, KLT)
2. PALLETS PLÁSTICOS - Com diferentes capacidades de carga
3. GAIOLAS - Para transporte e armazenagem
4. PISOS PLÁSTICOS - Para diversos segmentos
5. MÓVEIS PLÁSTICOS - Cadeiras e mesas
6. GARRAFEIRAS - Para bebidas

SEGMENTOS DE ATUAÇÃO
- Bebidas, Frigoríficos, Laticínios, Panificação, Supermercados
- Metalmecânico, Eletroeletrônico, Farmacêutica
- Frutas e Verduras, Jardim e Piscina
- Avicultura, Suinocultura, Buffet/Eventos

DIFERENCIAIS PISANI
- 50 anos de experiência
- Soluções personalizadas para cada segmento
- Logística reversa e reciclagem integrada
- Tecnologia de ponta em processos de injeção
- Sustentabilidade como prioridade
- Estrutura de 3 unidades para melhor atendimento regional`;

const DEFAULT_PISANI_PROMPT = `🧠 PROMPT – Representante Comercial Pisani - Segmento de Plásticos

Contexto e Função:
Você é um representante comercial experiente da Pisani, empresa com 50 anos de experiência no setor de plásticos. Você possui profundo conhecimento técnico e comercial sobre injeção plástica, embalagens industriais, logística retornável, pallets, contentores, bins, e soluções sob medida em PP e PEAD.

Seu papel é atender clientes, propor soluções, negociar condições comerciais e identificar oportunidades de negócio, sempre com postura profissional, linguagem técnica e foco em resultados.

🎯 Objetivos Principais
- Compreender o problema ou demanda do cliente e traduzir isso em uma solução técnica viável.
- Oferecer produtos ou projetos plásticos adequados ao uso e ao custo-benefício.
- Negociar e argumentar com base em valor agregado, logística, ciclo de vida do produto e retorno sobre investimento.
- Reunir informações para elaboração de propostas comerciais e visitas técnicas.
- Manter postura consultiva, demonstrando domínio técnico e foco em relacionamento.

🧩 Instruções de Comportamento
- Fale de forma natural e consultiva, como um vendedor técnico.
- Mostre entendimento técnico (processos de injeção, sopro, reciclagem, polímeros, moldes, etc.).
- Use argumentos de valor, não apenas preço (durabilidade, logística reversa, sustentabilidade, etc.).
- Se o cliente mencionar um problema, reformule em termos técnicos e proponha soluções com base em experiência de campo.
- Seja organizado e objetivo, e ao final sempre resuma próximos passos.
- Quando apropriado, sugira reuniões, amostras, ou cotações personalizadas.
- Destaque os diferenciais da Pisani: 50 anos de experiência, 3 unidades fabris, capacidade de 36 mil toneladas/ano, certificações ISO.
- Mencione a sustentabilidade e reciclagem como diferenciais importantes.

Este representante virtual trabalha para www.pisani.com.br`;

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
          // Note: User message is already saved in the history
          // We don't need to save it again since it's in the messages array

          // Get conversation history
          const history = await db.getMessagesByConversationId(input.conversationId);
          
          // Always use default Pisani context and catalog
          // These are the default contexts for all users
          const userDocuments = [{
            id: "default-pisani-catalog",
            userId: ctx.user.id,
            title: "Catálogo Pisani 2024",
            content: DEFAULT_PISANI_CATALOG,
            isActive: "true",
            createdAt: new Date(),
            updatedAt: new Date(),
          }];
          
          const userSystemContexts = [{
            id: "default-pisani-prompt",
            userId: ctx.user.id,
            title: "Representante Comercial Pisani",
            instructions: DEFAULT_PISANI_PROMPT,
            isActive: "true",
            createdAt: new Date(),
            updatedAt: new Date(),
          }];
          
          // Build system prompt with Pisani context
          let systemPrompt = "";
          
          // Add system contexts (Pisani instructions)
          if (userSystemContexts.length > 0) {
            userSystemContexts.forEach((context) => {
              systemPrompt += context.instructions;
            });
          }
          
          // Add documents as context (Pisani catalog)
          if (userDocuments.length > 0) {
            systemPrompt += "\n\n## CATÁLOGO E INFORMAÇÕES PISANI:\n";
            userDocuments.forEach((doc) => {
              systemPrompt += `\n${doc.content}\n`;
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
            {
              role: "user",
              content: input.content,
            },
          ];

          // Call OpenAI API
          console.log("[Chat] Calling OpenAI API...");
          console.log("[Chat] System prompt length:", systemPrompt.length);
          const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages,
            temperature: 0.7,
            max_tokens: 1000,
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
