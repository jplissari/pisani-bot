import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"documents" | "contexts">("documents");

  // Documents
  const documentsQuery = trpc.documents.getDocuments.useQuery();
  const createDocMutation = trpc.documents.createDocument.useMutation();
  const deleteDocMutation = trpc.documents.deleteDocument.useMutation();
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");

  // System Contexts
  const contextsQuery = trpc.systemContext.getContexts.useQuery();
  const createContextMutation = trpc.systemContext.createContext.useMutation();
  const deleteContextMutation = trpc.systemContext.deleteContext.useMutation();
  const [ctxTitle, setCtxTitle] = useState("");
  const [ctxInstructions, setCtxInstructions] = useState("");

  const handleAddDocument = async () => {
    if (!docTitle.trim() || !docContent.trim()) return;
    
    try {
      await createDocMutation.mutateAsync({
        title: docTitle,
        content: docContent,
      });
      setDocTitle("");
      setDocContent("");
      documentsQuery.refetch();
    } catch (error) {
      console.error("Erro ao criar documento:", error);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocMutation.mutateAsync({ id });
      documentsQuery.refetch();
    } catch (error) {
      console.error("Erro ao deletar documento:", error);
    }
  };

  const handleAddContext = async () => {
    if (!ctxTitle.trim() || !ctxInstructions.trim()) return;
    
    try {
      await createContextMutation.mutateAsync({
        title: ctxTitle,
        instructions: ctxInstructions,
      });
      setCtxTitle("");
      setCtxInstructions("");
      contextsQuery.refetch();
    } catch (error) {
      console.error("Erro ao criar contexto:", error);
    }
  };

  const handleDeleteContext = async (id: string) => {
    try {
      await deleteContextMutation.mutateAsync({ id });
      contextsQuery.refetch();
    } catch (error) {
      console.error("Erro ao deletar contexto:", error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Você precisa estar autenticado para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Administração do Chatbot</h1>
        <p className="text-gray-600 mb-8">Gerenciar documentos e instruções do assistente</p>

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <Button
            variant={activeTab === "documents" ? "default" : "outline"}
            onClick={() => setActiveTab("documents")}
          >
            Documentos
          </Button>
          <Button
            variant={activeTab === "contexts" ? "default" : "outline"}
            onClick={() => setActiveTab("contexts")}
          >
            Instruções
          </Button>
        </div>

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="grid gap-6">
            {/* Add Document Form */}
            <Card>
              <CardHeader>
                <CardTitle>Adicionar Novo Documento</CardTitle>
                <CardDescription>
                  Cole o conteúdo do seu catálogo, manual ou documentação aqui
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Título do documento (ex: Catálogo de Produtos)"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Cole o conteúdo do documento aqui..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleAddDocument}
                  disabled={!docTitle.trim() || !docContent.trim() || createDocMutation.isPending}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createDocMutation.isPending ? "Adicionando..." : "Adicionar Documento"}
                </Button>
              </CardContent>
            </Card>

            {/* Documents List */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Documentos Ativos</h2>
              <div className="grid gap-4">
                {documentsQuery.data?.map((doc) => (
                  <Card key={doc.id}>
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div>
                        <CardTitle>{doc.title}</CardTitle>
                        <CardDescription>
                          {doc.content.substring(0, 100)}...
                        </CardDescription>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={deleteDocMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                  </Card>
                ))}
                {documentsQuery.data?.length === 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-gray-500 text-center">Nenhum documento adicionado ainda</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contexts Tab */}
        {activeTab === "contexts" && (
          <div className="grid gap-6">
            {/* Add Context Form */}
            <Card>
              <CardHeader>
                <CardTitle>Adicionar Nova Instrução</CardTitle>
                <CardDescription>
                  Define como o assistente deve se comportar e responder
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Título da instrução (ex: Representante Comercial)"
                  value={ctxTitle}
                  onChange={(e) => setCtxTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Descreva as instruções para o assistente..."
                  value={ctxInstructions}
                  onChange={(e) => setCtxInstructions(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleAddContext}
                  disabled={!ctxTitle.trim() || !ctxInstructions.trim() || createContextMutation.isPending}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createContextMutation.isPending ? "Adicionando..." : "Adicionar Instrução"}
                </Button>
              </CardContent>
            </Card>

            {/* Contexts List */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Instruções Ativas</h2>
              <div className="grid gap-4">
                {contextsQuery.data?.map((ctx) => (
                  <Card key={ctx.id}>
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div>
                        <CardTitle>{ctx.title}</CardTitle>
                        <CardDescription>
                          {ctx.instructions.substring(0, 100)}...
                        </CardDescription>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteContext(ctx.id)}
                        disabled={deleteContextMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                  </Card>
                ))}
                {contextsQuery.data?.length === 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-gray-500 text-center">Nenhuma instrução adicionada ainda</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

