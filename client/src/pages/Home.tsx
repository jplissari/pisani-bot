import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { MessageCircle, Send, Trash2, Plus, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

interface Conversation {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [inputMessage, setInputMessage] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Queries
  const { data: conversations = [], isLoading: loadingConversations } = trpc.chat.getConversations.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: messages = [], isLoading: loadingMessages } = trpc.chat.getMessages.useQuery(
    { conversationId: selectedConversationId! },
    { enabled: !!selectedConversationId }
  );

  // Mutations
  const createConversation = trpc.chat.createConversation.useMutation({
    onSuccess: (newConv) => {
      utils.chat.getConversations.invalidate();
      setSelectedConversationId(newConv.id);
      toast.success("Nova conversa criada!");
    },
    onError: () => {
      toast.error("Erro ao criar conversa");
    },
  });

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate();
      utils.chat.getConversations.invalidate();
      setInputMessage("");
    },
    onError: () => {
      toast.error("Erro ao enviar mensagem");
    },
  });

  const deleteConversation = trpc.chat.deleteConversation.useMutation({
    onSuccess: () => {
      utils.chat.getConversations.invalidate();
      setSelectedConversationId(null);
      toast.success("Conversa excluída!");
    },
    onError: () => {
      toast.error("Erro ao excluir conversa");
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, sendMessage.isPending]);

  // Select first conversation on load
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedConversationId) return;

    sendMessage.mutate({
      conversationId: selectedConversationId,
      content: inputMessage.trim(),
    });
  };

  const handleNewConversation = () => {
    createConversation.mutate({ title: "Nova Conversa" });
  };

  const handleDeleteConversation = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta conversa?")) {
      deleteConversation.mutate({ conversationId: id });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
          <div className="flex justify-center">
            <MessageCircle className="h-16 w-16 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{APP_TITLE}</h1>
            <p className="text-muted-foreground">
              Converse com inteligência artificial de forma simples e intuitiva. Faça login para começar.
            </p>
          </div>
          <Button size="lg" className="w-full" asChild>
            <a href={getLoginUrl()}>Fazer Login</a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto h-screen flex flex-col py-4">
        {/* Header */}
        <div className="bg-white rounded-t-lg shadow-md p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{APP_TITLE}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Olá, {user?.name || "Usuário"}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex bg-white shadow-md overflow-hidden">
          {/* Sidebar - Conversations List */}
          <div className="w-64 border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <Button onClick={handleNewConversation} className="w-full" disabled={createConversation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conversa
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {loadingConversations ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center p-4">
                    Nenhuma conversa ainda. Crie uma nova!
                  </p>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors group relative ${
                        selectedConversationId === conv.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedConversationId(conv.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate flex-1">
                          {conv.title || "Conversa sem título"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(conv.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedConversationId ? (
              <>
                {/* Messages */}
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                  {loadingMessages ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-lg text-muted-foreground">
                        Comece uma conversa enviando uma mensagem
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-3xl mx-auto">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-4 ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      {sendMessage.isPending && (
                        <div className="flex justify-start">
                          <div className="bg-muted text-foreground rounded-lg p-4">
                            <Loader2 className="h-5 w-5 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t border-border p-4">
                  <form onSubmit={handleSendMessage} className="flex gap-2 max-w-3xl mx-auto">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      className="flex-1"
                      disabled={sendMessage.isPending}
                    />
                    <Button type="submit" disabled={!inputMessage.trim() || sendMessage.isPending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="h-24 w-24 text-muted-foreground mx-auto mb-4" />
                  <p className="text-xl text-muted-foreground">
                    Selecione ou crie uma conversa para começar
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

