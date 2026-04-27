import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { PlayerExportData, TeamExportData, SGSDimensions } from "./types";

// Design system constants
const BG = "#07090c";
const GREEN = "#198c3d";
const WHITE = "#ffffff";
const GRAY = "#a0a0a0";
const DARK_CARD = "#0e1117";
const GREEN_DIM = "#0d5526";

// Page dimensions (A4 portrait in mm)
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

function setFill(doc: jsPDF, hex: string) {
  doc.setFillColor(...hexToRgb(hex));
}

function setDraw(doc: jsPDF, hex: string) {
  doc.setDrawColor(...hexToRgb(hex));
}

function setTextColor(doc: jsPDF, hex: string) {
  doc.setTextColor(...hexToRgb(hex));
}

function initPage(doc: jsPDF) {
  setFill(doc, BG);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function drawHeader(doc: jsPDF, title: string, subtitle?: string): number {
  // Green banner
  setFill(doc, GREEN);
  doc.rect(0, 0, PAGE_W, 20, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setTextColor(doc, WHITE);
  doc.text("RAJA COGNI LAB", MARGIN, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(title, PAGE_W / 2, 13, { align: "center" });

  // Separator line below banner
  setDraw(doc, GREEN);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 22, PAGE_W - MARGIN, 22);

  let y = 28;

  if (subtitle) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setTextColor(doc, GRAY);
    doc.text(subtitle, MARGIN, y);
    y += 6;
  }

  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  setFill(doc, GREEN_DIM);
  doc.roundedRect(MARGIN, y, CONTENT_W, 7, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setTextColor(doc, GREEN);
  doc.text(title.toUpperCase(), MARGIN + 4, y + 4.8);
  return y + 10;
}

function drawCognitiveBars(
  doc: jsPDF,
  dimensions: SGSDimensions,
  y: number
): number {
  const labels: { key: keyof SGSDimensions; label: string }[] = [
    { key: "reactionTime", label: "Temps de Réaction" },
    { key: "inhibition", label: "Contrôle Inhibiteur" },
    { key: "workingMemory", label: "Mémoire de Travail" },
    { key: "attention", label: "Attention Sélective" },
    { key: "flexibility", label: "Flexibilité Cognitive" },
    { key: "anticipation", label: "Anticipation" },
  ];

  const labelW = 42;
  const barW = CONTENT_W - labelW - 18;
  const barH = 4.5;
  const rowH = 8;

  for (const { key, label } of labels) {
    const score = dimensions[key];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setTextColor(doc, GRAY);
    doc.text(label, MARGIN, y + barH - 0.5);

    // Background bar
    setFill(doc, "#1a1f2c");
    doc.roundedRect(MARGIN + labelW, y, barW, barH, 1, 1, "F");

    // Filled portion
    const fillW = Math.max(2, (score / 100) * barW);
    const barColor = score >= 75 ? GREEN : score >= 50 ? "#e8a020" : "#c0392b";
    setFill(doc, barColor);
    doc.roundedRect(MARGIN + labelW, y, fillW, barH, 1, 1, "F");

    // Score text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextColor(doc, WHITE);
    doc.text(
      `${score}/100`,
      MARGIN + labelW + barW + 3,
      y + barH - 0.5
    );

    y += rowH;
  }

  return y + 2;
}

function drawSGSBadge(doc: jsPDF, score: number | null, x: number, y: number) {
  const s = score ?? 0;
  setFill(doc, GREEN);
  doc.roundedRect(x, y, 28, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setTextColor(doc, WHITE);
  doc.text(String(s), x + 14, y + 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setTextColor(doc, "#c5f5d7");
  doc.text("SGS /100", x + 14, y + 16, { align: "center" });
}

function drawMetricRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  isAlt: boolean
): number {
  if (isAlt) {
    setFill(doc, DARK_CARD);
    doc.rect(MARGIN, y - 1, CONTENT_W, 7, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, GRAY);
  doc.text(label, MARGIN + 3, y + 4.5);
  doc.setFont("helvetica", "bold");
  setTextColor(doc, WHITE);
  doc.text(value, PAGE_W - MARGIN - 3, y + 4.5, { align: "right" });
  return y + 7;
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: fr });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatVal(
  val: number | null,
  unit: string,
  decimals = 0
): string {
  if (val === null) return "—";
  return `${val.toFixed(decimals)} ${unit}`;
}

// ─── PLAYER PDF ──────────────────────────────────────────────────────────────

export function generatePlayerPDF(data: PlayerExportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const lastSession = data.sessions[0] ?? null;

  // ── PAGE 1 — Synthèse ────────────────────────────────────────────────────
  initPage(doc);
  let y = drawHeader(doc, "Rapport Cognitif Individuel");

  // Player identity block
  const posText = data.position ? ` | ${data.position}` : "";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setTextColor(doc, WHITE);
  doc.text(data.fullName ?? "Joueur inconnu", MARGIN, y + 4);

  if (data.position) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setTextColor(doc, GRAY);
    doc.text(posText.slice(3), MARGIN, y + 10);
  }

  if (lastSession) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setTextColor(doc, GRAY);
    doc.text(
      `Dernière session : ${formatDate(lastSession.createdAt)}`,
      MARGIN,
      y + 16
    );
  }

  // SGS badge
  if (lastSession) {
    drawSGSBadge(doc, lastSession.sgsScore, PAGE_W - MARGIN - 30, y);
  }

  y += 26;

  // ── Profil cognitif ──────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "Profil Cognitif", y);

  if (lastSession) {
    y = drawCognitiveBars(doc, lastSession.dimensions, y);
  } else {
    setTextColor(doc, GRAY);
    doc.setFontSize(9);
    doc.text("Aucune donnée de session disponible.", MARGIN, y + 5);
    y += 12;
  }

  y += 4;

  // ── Historique des sessions ───────────────────────────────────────────────
  y = drawSectionTitle(doc, "Historique des Sessions", y);

  // Table header
  setFill(doc, "#1a1f2c");
  doc.rect(MARGIN, y, CONTENT_W, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setTextColor(doc, GRAY);
  const cols = [0, 28, 50, 72, 94, 116];
  const headers = ["Date", "SGS", "Flexib.", "Mém. Trav.", "Inhibition", "Réaction"];
  headers.forEach((h, i) => doc.text(h, MARGIN + cols[i], y + 5));
  y += 8;

  const maxRows = Math.min(data.sessions.length, 10);
  for (let i = 0; i < maxRows; i++) {
    const s = data.sessions[i];
    if (i % 2 === 1) {
      setFill(doc, DARK_CARD);
      doc.rect(MARGIN, y, CONTENT_W, 6.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, WHITE);
    const row = [
      formatDate(s.createdAt),
      s.sgsScore !== null ? String(s.sgsScore) : "—",
      String(s.dimensions.flexibility),
      String(s.dimensions.workingMemory),
      String(s.dimensions.inhibition),
      String(s.dimensions.reactionTime),
    ];
    row.forEach((cell, ci) =>
      doc.text(cell, MARGIN + cols[ci], y + 4.5)
    );
    y += 6.5;
  }

  y += 4;

  // Generated at
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  setTextColor(doc, "#555566");
  doc.text(
    `Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}`,
    PAGE_W - MARGIN,
    PAGE_H - 8,
    { align: "right" }
  );

  // ── PAGE 2 — Annexe détaillée ─────────────────────────────────────────────
  doc.addPage();
  initPage(doc);
  y = drawHeader(
    doc,
    "Annexe — Détail des Métriques",
    lastSession
      ? `Session du ${formatDate(lastSession.createdAt)}`
      : "Dernière session"
  );

  if (!lastSession) {
    setTextColor(doc, GRAY);
    doc.setFontSize(10);
    doc.text("Aucune session disponible.", MARGIN, y + 10);
  } else {
    const { simon, nback, tmt } = lastSession;

    // Simon Task
    y = drawSectionTitle(doc, "Simon Task", y);
    y = drawMetricRow(doc, "Effet Simon", formatVal(simon.simon_effect_ms, "ms"), y, false);
    y = drawMetricRow(doc, "Taux d'erreurs", formatVal(simon.simon_error_pct, "%", 1), y, true);
    y = drawMetricRow(doc, "TR congruent", formatVal(simon.simon_rt_congruent, "ms"), y, false);
    y = drawMetricRow(doc, "TR incongruent", formatVal(simon.simon_rt_incongruent, "ms"), y, true);
    y += 4;

    // N-Back 2
    y = drawSectionTitle(doc, "N-Back 2", y);
    y = drawMetricRow(doc, "D-prime", formatVal(nback.nback_dprime, "", 2), y, false);
    y = drawMetricRow(doc, "Précision", formatVal(nback.nback_accuracy, "%", 1), y, true);
    y = drawMetricRow(doc, "Taux de hits", formatVal(nback.nback_hit_rate, "%", 1), y, false);
    y = drawMetricRow(doc, "Fausses alarmes", formatVal(nback.nback_false_alarm, "%", 1), y, true);
    y += 4;

    // TMT A+B
    y = drawSectionTitle(doc, "TMT A+B", y);
    y = drawMetricRow(doc, "Temps partie A", formatVal(tmt.tmt_a_time, "s", 1), y, false);
    y = drawMetricRow(doc, "Temps partie B", formatVal(tmt.tmt_b_time, "s", 1), y, true);
    y = drawMetricRow(doc, "Ratio B/A", formatVal(tmt.tmt_ratio, "", 2), y, false);
    y = drawMetricRow(doc, "Erreurs", tmt.tmt_errors !== null ? String(tmt.tmt_errors) : "—", y, true);
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  setTextColor(doc, "#555566");
  doc.text(
    `Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}`,
    PAGE_W - MARGIN,
    PAGE_H - 8,
    { align: "right" }
  );

  const filename = `rapport_${(data.fullName ?? "joueur").replace(/\s+/g, "_").toLowerCase()}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(filename);
}

// ─── TEAM PDF ────────────────────────────────────────────────────────────────

function trendArrow(sessions: PlayerExportData["sessions"]): string {
  if (sessions.length < 2) return "→";
  const last = sessions[0].sgsScore ?? 0;
  const prev = sessions[1].sgsScore ?? 0;
  if (last > prev + 2) return "↑";
  if (last < prev - 2) return "↓";
  return "→";
}

export function generateTeamPDF(data: TeamExportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const dateLabel = format(new Date(data.generatedAt), "dd/MM/yyyy", {
    locale: fr,
  });

  // ── PAGE 1 — Vue d'ensemble équipe ────────────────────────────────────────
  initPage(doc);
  let y = drawHeader(doc, `Rapport Équipe — ${dateLabel}`);

  // Summary table
  y = drawSectionTitle(doc, "Récapitulatif des Joueurs", y);

  // Table header
  setFill(doc, "#1a1f2c");
  doc.rect(MARGIN, y, CONTENT_W, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setTextColor(doc, GRAY);
  const teamCols = [0, 54, 80, 100, 128];
  const teamHeaders = ["Joueur", "Position", "SGS", "Dernière session", "Tendance"];
  teamHeaders.forEach((h, i) => doc.text(h, MARGIN + teamCols[i], y + 5));
  y += 8;

  for (let i = 0; i < data.players.length; i++) {
    const p = data.players[i];
    const lastSess = p.sessions[0] ?? null;
    if (i % 2 === 1) {
      setFill(doc, DARK_CARD);
      doc.rect(MARGIN, y, CONTENT_W, 6.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, WHITE);
    const row = [
      (p.fullName ?? "—").slice(0, 22),
      (p.position ?? "—").slice(0, 14),
      lastSess?.sgsScore !== null && lastSess?.sgsScore !== undefined
        ? String(lastSess.sgsScore)
        : "—",
      lastSess ? formatDate(lastSess.createdAt) : "—",
      trendArrow(p.sessions),
    ];
    row.forEach((cell, ci) =>
      doc.text(cell, MARGIN + teamCols[ci], y + 4.5)
    );
    y += 6.5;
  }

  y += 6;

  // Team averages
  y = drawSectionTitle(doc, "Moyennes de l'Équipe", y);
  y = drawCognitiveBars(doc, data.teamAverages, y);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  setTextColor(doc, "#555566");
  doc.text(
    `Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}`,
    PAGE_W - MARGIN,
    PAGE_H - 8,
    { align: "right" }
  );

  // ── Pages 2..N — One player per page (compact) ────────────────────────────
  for (const player of data.players) {
    doc.addPage();
    initPage(doc);
    y = drawHeader(doc, player.fullName ?? "Joueur");

    const lastSess = player.sessions[0] ?? null;

    // Player info + SGS badge
    if (player.position) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setTextColor(doc, GRAY);
      doc.text(player.position, MARGIN, y + 4);
    }
    if (lastSess) {
      drawSGSBadge(doc, lastSess.sgsScore, PAGE_W - MARGIN - 30, y - 4);
    }
    y += 10;

    // Cognitive profile bars
    y = drawSectionTitle(doc, "Profil Cognitif", y);
    if (lastSess) {
      y = drawCognitiveBars(doc, lastSess.dimensions, y);
    } else {
      setTextColor(doc, GRAY);
      doc.setFontSize(8);
      doc.text("Aucune donnée.", MARGIN, y + 4);
      y += 10;
    }

    y += 4;

    // Last 3 sessions table
    y = drawSectionTitle(doc, "3 Dernières Sessions", y);
    setFill(doc, "#1a1f2c");
    doc.rect(MARGIN, y, CONTENT_W, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setTextColor(doc, GRAY);
    const sCols = [0, 24, 46, 68, 90, 112];
    const sHeaders = ["Date", "SGS", "Flexib.", "Mém. Trav.", "Inhibition", "Réaction"];
    sHeaders.forEach((h, i) => doc.text(h, MARGIN + sCols[i], y + 4));
    y += 7;

    for (let i = 0; i < Math.min(player.sessions.length, 3); i++) {
      const s = player.sessions[i];
      if (i % 2 === 1) {
        setFill(doc, DARK_CARD);
        doc.rect(MARGIN, y, CONTENT_W, 6, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setTextColor(doc, WHITE);
      const row = [
        formatDate(s.createdAt),
        s.sgsScore !== null ? String(s.sgsScore) : "—",
        String(s.dimensions.flexibility),
        String(s.dimensions.workingMemory),
        String(s.dimensions.inhibition),
        String(s.dimensions.reactionTime),
      ];
      row.forEach((cell, ci) =>
        doc.text(cell, MARGIN + sCols[ci], y + 4)
      );
      y += 6;
    }

    y += 6;

    // Key metrics summary
    if (lastSess) {
      y = drawSectionTitle(doc, "Métriques Clés (Dernière Session)", y);
      const { simon, nback, tmt } = lastSess;
      y = drawMetricRow(doc, "Effet Simon", formatVal(simon.simon_effect_ms, "ms"), y, false);
      y = drawMetricRow(doc, "N-Back D-prime", formatVal(nback.nback_dprime, "", 2), y, true);
      y = drawMetricRow(doc, "TMT Ratio B/A", formatVal(tmt.tmt_ratio, "", 2), y, false);
    }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    setTextColor(doc, "#555566");
    doc.text(
      `Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}`,
      PAGE_W - MARGIN,
      PAGE_H - 8,
      { align: "right" }
    );
  }

  doc.save(`rapport_equipe_${format(new Date(), "yyyyMMdd")}.pdf`);
}
