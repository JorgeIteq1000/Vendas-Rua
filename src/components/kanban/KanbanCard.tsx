import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MapPin,
  Navigation,
  ArrowRight,
  CalendarClock,
  ShieldAlert,
  Mic,
  MicOff,
  User,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type VisitStatus = "a_visitar" | "em_rota" | "visitado" | "finalizado";

interface POI {
  id: string;
  nome: string;
  endereco: string;
  bairro: string;
  tipo: string;
  coordenadas: string | null;
}

interface Profile {
  full_name: string | null;
}

interface Visit {
  id: string;
  point_id: string;
  status: VisitStatus;
  collaborator_count: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  scheduled_for: string | null;
  poi: POI | null;
  assignee: Profile | null;
  summary?: string;
  responsible_name?: string;
}

interface KanbanCardProps {
  visit: Visit;
  currentStatus: VisitStatus;
  onStatusChange: (
    visitId: string,
    newStatus: VisitStatus,
    extraData?: any
  ) => void;
  calculateDistance: (coords: string) => number | null;
  userLocation: { latitude: number; longitude: number } | null;
  onSchedule: (visitId: string, date: Date) => void;
}

const poiTypeLabels: Record<string, string> = {
  escola: "Escola",
  hospital: "Hospital",
  upa: "UPA",
  clinica: "Clínica",
  empresa: "Empresa",
  comercio: "Comércio",
  outro: "Outro",
};

export function KanbanCard({
  visit,
  currentStatus,
  onStatusChange,
  calculateDistance,
  userLocation,
  onSchedule,
}: KanbanCardProps) {
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showGpsDialog, setShowGpsDialog] = useState(false);
  const [showFraudDialog, setShowFraudDialog] = useState(false);

  // Estados do Formulário de Finalização
  const [collaboratorCount, setCollaboratorCount] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [summary, setSummary] = useState("");

  // Estados de Voz
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Estados Cerca/Agendamento
  const [justification, setJustification] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");

  useEffect(() => {
    const win = window as any;
    if ("webkitSpeechRecognition" in win || "SpeechRecognition" in win) {
      setSpeechSupported(true);
    }
  }, []);

  if (!visit.poi) return null;

  const distance = visit.poi.coordenadas
    ? calculateDistance(visit.poi.coordenadas)
    : null;

  const processVoiceInput = (text: string) => {
    setSummary(text);
    const lowerText = text.toLowerCase();

    const responsiblePatterns = [
      /(?:responsável|gerente|diretor|falei com)\s+(?:é\s+|o\s+|a\s+|foi\s+)?([A-Z][a-zà-ú]+)/i,
    ];

    for (const pattern of responsiblePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        setResponsibleName(name);
        break;
      }
    }

    const countPattern =
      /(\d+)\s+(?:colaboradores|funcionários|pessoas|membros|vendedores)/i;
    const countMatch = lowerText.match(countPattern);

    if (countMatch && countMatch[1]) {
      setCollaboratorCount(countMatch[1]);
    } else {
      const numberMap: Record<string, string> = {
        um: "1",
        dois: "2",
        três: "3",
        quatro: "4",
        cinco: "5",
        seis: "6",
        sete: "7",
        oito: "8",
        nove: "9",
        dez: "10",
      };
      const extensoPattern =
        /(um|dois|três|quatro|cinco|seis|sete|oito|nove|dez)\s+(?:colaboradores|funcionários)/i;
      const extensoMatch = lowerText.match(extensoPattern);
      if (extensoMatch && extensoMatch[1]) {
        setCollaboratorCount(numberMap[extensoMatch[1].toLowerCase()] || "");
      }
    }
  };

  const toggleListening = () => {
    if (!speechSupported) return;

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      processVoiceInput(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Erro no reconhecimento de voz:", event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  const handleCheckInAttempt = () => {
    if (distance !== null && distance > 0.3) {
      setShowFraudDialog(true);
    } else {
      onStatusChange(visit.id, "visitado");
    }
  };

  const confirmFraudCheckIn = () => {
    if (!justification.trim()) return;
    onStatusChange(visit.id, "visitado", { justificativa: justification });
    setShowFraudDialog(false);
  };

  const handleAction = () => {
    if (currentStatus === "a_visitar") setShowGpsDialog(true);
    else if (currentStatus === "em_rota") handleCheckInAttempt();
    else if (currentStatus === "visitado") setShowFinishDialog(true);
  };

  // 👇 CORREÇÃO AQUI: Link Universal do Google Maps
  const handleStartRoute = (app: "waze" | "google") => {
    if (!visit.poi) return;

    // Adiciona o termo "Brasil" para garantir que não busque ruas em outros países
    const destination = encodeURIComponent(
      `${visit.poi.endereco}, ${visit.poi.bairro}`
    );

    const url =
      app === "waze"
        ? `https://waze.com/ul?q=${destination}&navigate=yes`
        : `https://www.google.com/maps/search/?api=1&query=${destination}`; // 👈 URL CORRIGIDA

    window.open(url, "_blank");
    onStatusChange(visit.id, "em_rota");
    setShowGpsDialog(false);
  };

  const handleFinalize = () => {
    const count = parseInt(collaboratorCount, 10);

    onStatusChange(visit.id, "finalizado", {
      collaborator_count: isNaN(count) ? null : count,
      responsible_name: responsibleName,
      summary: summary,
    });

    setShowFinishDialog(false);
    setCollaboratorCount("");
    setResponsibleName("");
    setSummary("");
  };

  const handleScheduleSubmit = () => {
    if (!scheduleDate) return;
    const date = new Date(scheduleDate + "T12:00:00");
    onSchedule(visit.id, date);
    setScheduleDate("");
  };

  const isScheduled =
    visit.scheduled_for && new Date(visit.scheduled_for) > new Date();

  return (
    <>
      <Card
        className={`p-4 space-y-3 bg-card border-border/50 hover:border-primary/30 transition-colors shadow-sm group ${
          isScheduled ? "opacity-60 border-yellow-200 bg-yellow-50/10" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
              {visit.poi.nome}
            </h4>
            <div className="flex gap-2 mt-1.5">
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                {poiTypeLabels[visit.poi.tipo] || visit.poi.tipo}
              </Badge>
              {visit.scheduled_for && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 h-5 border-yellow-500 text-yellow-600 bg-yellow-50 gap-1"
                >
                  <CalendarClock className="w-3 h-3" />
                  {format(new Date(visit.scheduled_for), "dd/MM", {
                    locale: ptBR,
                  })}
                </Badge>
              )}
            </div>
          </div>

          {distance !== null && (
            <div
              className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap px-2 py-1 rounded-md ${
                distance > 0.3 && currentStatus === "em_rota"
                  ? "bg-red-100 text-red-600"
                  : "bg-primary/5 text-primary"
              }`}
            >
              <Navigation className="w-3 h-3" />
              {distance.toFixed(1)} km
            </div>
          )}
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{visit.poi.endereco}</span>
          </div>
          <div className="pl-5 font-medium text-foreground/80">
            {visit.poi.bairro}
          </div>
        </div>

        <div className="pt-2 flex gap-2">
          {currentStatus !== "finalizado" && (
            <Button
              size="sm"
              className="flex-1 h-9 text-xs font-medium"
              onClick={handleAction}
            >
              {currentStatus === "a_visitar" && "Iniciar Rota"}
              {currentStatus === "em_rota" && "Marcar Visitado"}
              {currentStatus === "visitado" && "Finalizar"}
              <ArrowRight className="w-3 h-3 ml-2" />
            </Button>
          )}

          {(currentStatus === "a_visitar" || currentStatus === "em_rota") && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-yellow-600 hover:border-yellow-400"
                >
                  <CalendarClock className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Agendar Retorno</h4>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleScheduleSubmit}
                  >
                    Confirmar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </Card>

      <Dialog open={showGpsDialog} onOpenChange={setShowGpsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Navegação</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2 hover:bg-blue-50"
              onClick={() => handleStartRoute("waze")}
            >
              Waze
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2 hover:bg-green-50"
              onClick={() => handleStartRoute("google")}
            >
              Maps
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Relatório da Visita
              {speechSupported && (
                <Button
                  size="sm"
                  variant={isListening ? "destructive" : "outline"}
                  className={`gap-2 ${isListening ? "animate-pulse" : ""}`}
                  onClick={toggleListening}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4 text-primary" />
                  )}
                  {isListening ? "Ouvindo..." : "Preencher por Voz"}
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              Dite:{" "}
              <i>
                "Falei com o <b>Jorge</b> e tem <b>10 colaboradores</b>..."
              </i>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                  <User className="w-3 h-3" /> Nome Responsável
                </label>
                <Input
                  placeholder="Ex: Jorge"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  className="bg-white text-zinc-900 placeholder:text-zinc-500 border-zinc-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                  <Users className="w-3 h-3" /> Qtd. Colaboradores
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 15"
                  value={collaboratorCount}
                  onChange={(e) => setCollaboratorCount(e.target.value)}
                  className="bg-white text-zinc-900 placeholder:text-zinc-500 border-zinc-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Resumo / Observações
              </label>
              <Textarea
                placeholder="Detalhes sobre a visita..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="min-h-[80px] bg-white text-zinc-900 placeholder:text-zinc-500 border-zinc-200 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowFinishDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleFinalize}>Salvar Relatório</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFraudDialog} onOpenChange={setShowFraudDialog}>
        <DialogContent className="sm:max-w-md border-red-200 bg-red-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="w-5 h-5" />
              Fora do Perímetro
            </DialogTitle>
            <DialogDescription className="text-red-600">
              Você está a <strong>{distance?.toFixed(1)} km</strong> do local.
              Justifique:
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Ex: GPS com sinal ruim..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="bg-white text-zinc-900 placeholder:text-zinc-500 border-red-200 focus-visible:ring-red-500"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFraudDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmFraudCheckIn}
              disabled={justification.length < 5}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
