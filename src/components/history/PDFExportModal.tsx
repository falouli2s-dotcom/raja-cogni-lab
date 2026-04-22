import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { SessionGroup } from "./PDFExportTemplate";

export type ExportConfig =
  | { mode: "single"; sessionId: string }
  | { mode: "comparison"; sessionAId: string; sessionBId: string };

interface PDFExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: SessionGroup[];
  exporting: boolean;
  onConfirm: (config: ExportConfig) => void;
}

function sessionOptionLabel(g: SessionGroup) {
  const date = format(new Date(g.date), "dd MMM yyyy", { locale: fr });
  const tests = g.testTypes.length > 0 ? g.testTypes.join(" • ") : "—";
  return `${date} — SGS : ${g.sgs.global}/100 — ${tests}`;
}

export function PDFExportModal({
  open,
  onOpenChange,
  groups,
  exporting,
  onConfirm,
}: PDFExportModalProps) {
  const [tab, setTab] = useState<"single" | "comparison">("single");
  const [singleId, setSingleId] = useState<string | undefined>(groups[0]?.groupId);
  const [aId, setAId] = useState<string | undefined>(groups[0]?.groupId);
  const [bId, setBId] = useState<string | undefined>(groups[1]?.groupId);

  // Re-init defaults when modal opens or groups change
  useEffect(() => {
    if (open) {
      setSingleId(groups[0]?.groupId);
      setAId(groups[0]?.groupId);
      setBId(groups[1]?.groupId ?? groups[0]?.groupId);
    }
  }, [open, groups]);

  const canSingle = !!singleId;
  const canCompare = !!aId && !!bId && aId !== bId;
  const canConfirm = tab === "single" ? canSingle : canCompare;

  const optionsForA = useMemo(() => groups, [groups]);
  const optionsForB = useMemo(() => groups, [groups]);

  function handleConfirm() {
    if (tab === "single" && singleId) {
      onConfirm({ mode: "single", sessionId: singleId });
    } else if (tab === "comparison" && aId && bId) {
      onConfirm({ mode: "comparison", sessionAId: aId, sessionBId: bId });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !exporting && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurer l'export PDF</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "single" | "comparison")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Session unique</TabsTrigger>
            <TabsTrigger value="comparison" disabled={groups.length < 2}>
              Comparer deux sessions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Sélectionne la session à inclure dans le rapport.
            </p>
            <Select value={singleId} onValueChange={setSingleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une session" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.groupId} value={g.groupId} className="text-xs">
                    {sessionOptionLabel(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>

          <TabsContent value="comparison" className="mt-4 space-y-3">
            <div>
              <p
                className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "#c8102e" }}
              >
                ■ Session A
              </p>
              <Select value={aId} onValueChange={setAId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir la session A" />
                </SelectTrigger>
                <SelectContent>
                  {optionsForA.map((g) => (
                    <SelectItem
                      key={g.groupId}
                      value={g.groupId}
                      disabled={g.groupId === bId}
                      className="text-xs"
                    >
                      {sessionOptionLabel(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p
                className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "#2563eb" }}
              >
                ■ Session B
              </p>
              <Select value={bId} onValueChange={setBId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir la session B" />
                </SelectTrigger>
                <SelectContent>
                  {optionsForB.map((g) => (
                    <SelectItem
                      key={g.groupId}
                      value={g.groupId}
                      disabled={g.groupId === aId}
                      className="text-xs"
                    >
                      {sessionOptionLabel(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {aId && bId && aId === bId && (
              <p className="text-xs text-destructive">
                Les deux sessions doivent être différentes.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
          >
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération…
              </>
            ) : (
              "Générer le PDF"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
