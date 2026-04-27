/**
 * CogniRaja — ExportModal
 *
 * Drop in: src/components/coach/ExportModal.tsx
 *
 * Usage:
 *   <ExportModal
 *     coachId={coachId}
 *     player={player}   // omit for team export
 *     onClose={() => setOpen(false)}
 *   />
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { exportPlayerReport, exportTeamReport } from "@/lib/pdf-export-engine";
import {
  fetchPlayerExportData,
  fetchTeamExportData,
  fetchCoachName,
} from "@/lib/export-fetcher";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExportModalProps {
  coachId: string;
  /** Provide for single-player export; omit for team export. */
  player?: { id: string; full_name: string; position: string };
  onClose: () => void;
}

// ─── Status types ─────────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "success" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export function ExportModal({ coachId, player, onClose }: ExportModalProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const isTeamMode = !player;

  // ── Export handler ──────────────────────────────────────────────────────────
  async function handleExport() {
    try {
      setStatus("loading");
      setError(null);

      if (isTeamMode) {
        const [players, coachName] = await Promise.all([
          fetchTeamExportData(coachId),
          fetchCoachName(coachId),
        ]);

        if (players.length === 0) {
          throw new Error("Aucun joueur trouvé dans votre équipe.");
        }

        await exportTeamReport(players, coachName, { includeAnnex: true });
      } else {
        const playerData = await fetchPlayerExportData(player!.id);
        await exportPlayerReport(playerData, { includeAnnex: true });
      }

      setStatus("success");
      setTimeout(onClose, 1800);
    } catch (err: any) {
      setStatus("error");
      setError(err.message ?? "Une erreur est survenue lors de l'export.");
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-xl">📄</span>
            {isTeamMode ? "Exporter le rapport équipe" : `Exporter — ${player!.full_name}`}
          </DialogTitle>
          <DialogDescription>
            {isTeamMode
              ? "Génère un PDF complet avec la synthèse de l'équipe et le profil détaillé de chaque joueur."
              : "Génère un PDF avec le profil cognitif complet et l'annexe détaillée des métriques."}
          </DialogDescription>
        </DialogHeader>

        {/* Content preview */}
        <div className="rounded-lg border bg-slate-50 p-4 space-y-2 text-sm">
          <p className="font-medium text-slate-700">Le PDF contiendra :</p>
          <ul className="space-y-1 text-slate-600">
            {isTeamMode ? (
              <>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Vue d'ensemble de l'équipe (SGS, tendances)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Moyennes par dimension cognitive
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Profil individuel + historique pour chaque joueur
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Annexe détaillée des métriques par test
                </li>
              </>
            ) : (
              <>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Profil cognitif (6 dimensions, dernière session)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Historique complet des sessions
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Annexe : métriques détaillées Simon / N-Back / TMT
                </li>
              </>
            )}
          </ul>
          <div className="pt-1 flex items-center gap-2">
            <Badge variant="outline" className="text-xs text-slate-500">Format PDF</Badge>
            <Badge variant="outline" className="text-xs text-slate-500">Résumé + Annexe</Badge>
          </div>
        </div>

        {/* Status messages */}
        {status === "error" && error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}
        {status === "success" && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
            ✅ PDF généré avec succès — téléchargement en cours…
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={status === "loading"}>
            Annuler
          </Button>
          <Button
            onClick={handleExport}
            disabled={status === "loading" || status === "success"}
            className="bg-green-700 hover:bg-green-800 text-white min-w-[140px]"
          >
            {status === "loading" ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Génération…
              </span>
            ) : (
              "⬇️ Télécharger PDF"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
