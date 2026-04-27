import { useState } from "react";
import { Download, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { fetchPlayerExportData, fetchTeamExportData } from "@/lib/export/data-fetcher";
import { generatePlayerPDF, generateTeamPDF } from "@/lib/export/pdf-builder";

interface ExportButtonProps {
  scope: "player" | "team";
  playerId?: string;
  coachId: string;
  className?: string;
}

export function ExportButton({
  scope,
  playerId,
  coachId,
  className,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (scope === "player" && !playerId) {
      toast.error("Identifiant joueur manquant");
      return;
    }

    setLoading(true);
    try {
      if (scope === "player") {
        const data = await fetchPlayerExportData(
          supabase,
          playerId!,
          dateFrom,
          dateTo
        );
        generatePlayerPDF(data);
      } else {
        const data = await fetchTeamExportData(
          supabase,
          coachId,
          dateFrom,
          dateTo
        );
        generateTeamPDF(data);
      }
      setOpen(false);
      toast.success("Rapport exporté avec succès");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Erreur lors de la génération du rapport", {
        description:
          err instanceof Error ? err.message : "Une erreur est survenue",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => setOpen(true)}
      >
        <Download className="h-4 w-4" />
        Exporter PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Exporter le rapport</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-2">
            {/* Scope display */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Type de rapport
              </Label>
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium">
                {scope === "player" ? "Rapport individuel" : "Rapport équipe"}
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Du
                </Label>
                <DatePickerInput
                  value={dateFrom}
                  onChange={setDateFrom}
                  placeholder="Début"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Au
                </Label>
                <DatePickerInput
                  value={dateTo}
                  onChange={setDateTo}
                  placeholder="Fin"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button onClick={handleGenerate} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {loading ? "Génération..." : "Générer le PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DatePickerInput({
  value,
  onChange,
  placeholder,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal text-sm",
            !value && "text-muted-foreground"
          )}
        >
          <Calendar className="mr-2 h-3.5 w-3.5 shrink-0" />
          {value ? format(value, "dd/MM/yyyy", { locale: fr }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
