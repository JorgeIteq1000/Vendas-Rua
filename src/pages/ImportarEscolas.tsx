import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Upload,
  FileJson,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";

// Configurações Fixas
const ADMIN_UUID = "9dd4da91-a6a0-4bb1-9faa-3703cd21e6b3";
const POI_TYPE = "escola";
const BATCH_SIZE = 50; // Envia 50 escolas por vez para não sobrecarregar

export default function ImportarEscolas() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = (message: string) => {
    console.log(`[Importador] ${message}`);
    setLogs((prev) =>
      [`${new Date().toLocaleTimeString()} - ${message}`, ...prev].slice(0, 50)
    );
  };

  const processFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setProgress(0);
    setLogs([]);
    addLog(
      `Arquivo selecionado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`
    );

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const jsonData = JSON.parse(text);

        if (!Array.isArray(jsonData)) {
          throw new Error(
            "O arquivo JSON deve conter uma lista (array) de objetos."
          );
        }

        setTotalRecords(jsonData.length);
        addLog(`Total de registros encontrados: ${jsonData.length}`);

        await uploadInBatches(jsonData);
      } catch (error: any) {
        console.error("Erro ao processar arquivo:", error);
        addLog(`ERRO CRÍTICO: ${error.message}`);
        toast({
          variant: "destructive",
          title: "Erro na leitura",
          description: "O arquivo JSON está inválido ou corrompido.",
        });
        setIsLoading(false);
      }
    };

    reader.readAsText(file);
  };

  const uploadInBatches = async (data: any[]) => {
    let currentCount = 0;
    const total = data.length;

    // Prepara os dados conforme o schema do banco
    const formattedData = data.map((item, index) => ({
      nome: item.nome?.trim() || `Escola Sem Nome ${index}`,
      endereco: item.endereco?.trim() || "Endereço não informado",
      bairro: item.bairro?.trim() || "Bairro não informado",
      cep: item.cep?.trim() || null,
      telefone: item.telefone?.trim() || null,
      coordenadas: item.coordenadas?.trim() || null,
      tipo: POI_TYPE,
      created_by: ADMIN_UUID,
    }));

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = formattedData.slice(i, i + BATCH_SIZE);

      addLog(
        `Enviando lote ${Math.floor(i / BATCH_SIZE) + 1}... (${
          batch.length
        } itens)`
      );

      const { error } = await supabase.from("points_of_interest").insert(batch);

      if (error) {
        addLog(`ERRO no lote ${i}: ${error.message}`);
        console.error(error);
        toast({
          variant: "destructive",
          title: "Erro no envio",
          description: `Falha ao enviar lote ${i}. Verifique o console.`,
        });
        // Opcional: Break ou Continue. Continue tenta salvar o resto.
      } else {
        currentCount += batch.length;
        setImportedCount(currentCount);
        setProgress(Math.round((currentCount / total) * 100));
      }
    }

    setIsLoading(false);
    addLog("Processo finalizado!");
    toast({
      title: "Importação Concluída",
      description: `${currentCount} escolas foram importadas com sucesso.`,
    });
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Importar Escolas (Modo Turbo)
          </h1>
          <p className="text-muted-foreground">
            Ferramenta de importação em massa para arquivos JSON grandes.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5 text-primary" />
              Upload do Arquivo JSON
            </CardTitle>
            <CardDescription>
              O arquivo deve conter uma lista de objetos com: nome, endereco,
              bairro, cep, telefone, coordenadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isLoading && progress === 0 && (
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 border-gray-300">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Clique para enviar</span>{" "}
                      ou arraste o arquivo
                    </p>
                    <p className="text-xs text-gray-500">JSON (MAX. 50MB)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".json"
                    onChange={processFile}
                  />
                </label>
              </div>
            )}

            {isLoading && (
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Processando...</span>
                  <span>
                    {progress}% ({importedCount}/{totalRecords})
                  </span>
                </div>
                <Progress value={progress} className="h-4" />
                <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 p-3 rounded text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Não feche esta página até o final do processo.
                </div>
              </div>
            )}

            {progress === 100 && !isLoading && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Sucesso!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Todas as escolas foram importadas para o banco de dados.
                </AlertDescription>
              </Alert>
            )}

            {/* Console de Logs Visual */}
            <div className="bg-black/90 text-green-400 p-4 rounded-md font-mono text-xs h-48 overflow-y-auto">
              <div className="sticky top-0 bg-black/90 pb-2 border-b border-green-900 mb-2 font-bold flex justify-between">
                <span>TERMINAL LOGS</span>
                <span className="animate-pulse">_</span>
              </div>
              {logs.length === 0 ? (
                <span className="opacity-50">Aguardando início...</span>
              ) : (
                logs.map((log, i) => <div key={i}>{`> ${log}`}</div>)
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
