/**
 * CogniRaja — PDF Export Engine
 * Uses jsPDF + html2canvas (already in stack).
 *
 * Two export modes:
 *  - exportPlayerReport(playerId)  → single-player PDF (summary + detailed annex)
 *  - exportTeamReport(coachId)     → full-squad PDF (one page per player + team overview)
 */

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DimensionScore {
  label: string;
  score: number;       // 0-100
  percentile: number;  // 0-100
}

export interface TestMetric {
  metrique: string;
  valeur: number;
  details?: Record<string, unknown>;
}

export interface SessionResult {
  session_id: string;
  date: string;
  sgs_score: number;
  dimensions: DimensionScore[];
  tests: {
    simon: TestMetric[];
    nback: TestMetric[];
    tmt: TestMetric[];
  };
}

export interface PlayerData {
  id: string;
  full_name: string;
  position: string;
  age?: number;
  sessions: SessionResult[];       // chronological, oldest first
}

export interface ExportOptions {
  mode: "player" | "team";
  includeAnnex: boolean;           // always true in our case
  dateFrom?: string;               // ISO date filter
  dateTo?: string;
  language?: "fr" | "en";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Renders a hidden DOM node to a canvas, then returns a PNG data URL. */
async function domToImage(element: HTMLElement, scale = 2): Promise<string> {
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  return canvas.toDataURL("image/png");
}

/** Appends an image (data URL) to a jsPDF doc, auto-paging if it overflows. */
function addImageToDoc(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + height > pageH - 15) {
    doc.addPage();
    y = 15;
  }
  doc.addImage(dataUrl, "PNG", x, y, width, height);
  return y + height;
}

/** Formats an ISO date string to dd/mm/yyyy. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR");
}

/** Gets latest session from a player's sessions array. */
function latestSession(player: PlayerData): SessionResult | null {
  return player.sessions.length > 0
    ? player.sessions[player.sessions.length - 1]
    : null;
}

/** Computes trend: difference in SGS between last two sessions. */
function sgsTrend(player: PlayerData): number | null {
  if (player.sessions.length < 2) return null;
  const last = player.sessions[player.sessions.length - 1].sgs_score;
  const prev = player.sessions[player.sessions.length - 2].sgs_score;
  return last - prev;
}

// ─── Color palette (Raja green + dark theme on white PDF) ─────────────────────

const COLOR = {
  primary: [0, 128, 64] as [number, number, number],       // Raja green
  accent: [220, 38, 38] as [number, number, number],        // Raja red
  dark: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  light: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
};

// ─── PDF primitives ───────────────────────────────────────────────────────────

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();

  // Green banner
  doc.setFillColor(...COLOR.primary);
  doc.rect(0, 0, w, 28, "F");

  // Logo placeholder (circle)
  doc.setFillColor(...COLOR.white);
  doc.circle(18, 14, 8, "F");
  doc.setTextColor(...COLOR.primary);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("RAJA", 18, 15.5, { align: "center" });

  // Title
  doc.setTextColor(...COLOR.white);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 32, 12);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, 32, 19);

  // Date stamp
  doc.setFontSize(7);
  doc.text(`Généré le ${fmtDate(new Date().toISOString())}`, w - 10, 19, { align: "right" });
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setFillColor(...COLOR.primary);
  doc.rect(0, h - 10, w, 10, "F");

  doc.setTextColor(...COLOR.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("CogniRaja — Académie Raja Casablanca", 10, h - 3.5);
  doc.text(`Page ${pageNum} / ${totalPages}`, w - 10, h - 3.5, { align: "right" });
}

function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLOR.light);
  doc.rect(10, y, w - 20, 8, "F");
  doc.setDrawColor(...COLOR.primary);
  doc.setLineWidth(0.5);
  doc.line(10, y, 10, y + 8);

  doc.setTextColor(...COLOR.primary);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(text.toUpperCase(), 14, y + 5.5);
  return y + 12;
}

/** Horizontal bar chart for dimensions. */
function drawDimensionBars(
  doc: jsPDF,
  dimensions: DimensionScore[],
  startY: number
): number {
  const w = doc.internal.pageSize.getWidth();
  const barW = w - 80;
  let y = startY;

  dimensions.forEach((dim) => {
    // Label
    doc.setTextColor(...COLOR.dark);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(dim.label, 14, y + 4);

    // Background bar
    doc.setFillColor(...COLOR.border);
    doc.roundedRect(60, y, barW, 5, 1, 1, "F");

    // Filled bar
    const fillW = (dim.score / 100) * barW;
    const barColor =
      dim.score >= 70 ? COLOR.primary : dim.score >= 40 ? [234, 179, 8] as [number, number, number] : COLOR.accent;
    doc.setFillColor(...barColor);
    doc.roundedRect(60, y, fillW, 5, 1, 1, "F");

    // Score label
    doc.setTextColor(...COLOR.dark);
    doc.setFontSize(7);
    doc.text(`${dim.score}`, 60 + barW + 3, y + 4);

    // Percentile
    doc.setTextColor(...COLOR.muted);
    doc.text(`P${dim.percentile}`, w - 14, y + 4, { align: "right" });

    y += 9;
  });

  return y + 4;
}

/** Mini table renderer. */
function drawTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  startY: number,
  colWidths?: number[]
): number {
  const w = doc.internal.pageSize.getWidth();
  const margin = 10;
  const tableW = w - margin * 2;
  const widths = colWidths ?? headers.map(() => tableW / headers.length);
  let y = startY;
  const rowH = 7;

  // Header row
  doc.setFillColor(...COLOR.primary);
  doc.rect(margin, y, tableW, rowH, "F");
  doc.setTextColor(...COLOR.white);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");

  let x = margin;
  headers.forEach((h, i) => {
    doc.text(h, x + 2, y + 5);
    x += widths[i];
  });
  y += rowH;

  // Data rows
  rows.forEach((row, ri) => {
    if (ri % 2 === 0) {
      doc.setFillColor(...COLOR.light);
      doc.rect(margin, y, tableW, rowH, "F");
    }
    doc.setTextColor(...COLOR.dark);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");

    let x = margin;
    row.forEach((cell, ci) => {
      doc.text(String(cell), x + 2, y + 5);
      x += widths[ci];
    });
    y += rowH;
  });

  // Border
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.rect(margin, startY, tableW, y - startY, "S");

  return y + 4;
}

/** SGS score badge (large circle). */
function drawSgsBadge(doc: jsPDF, score: number, x: number, y: number) {
  const color =
    score >= 70 ? COLOR.primary : score >= 40 ? [234, 179, 8] as [number, number, number] : COLOR.accent;

  doc.setFillColor(...color);
  doc.circle(x, y, 14, "F");

  doc.setTextColor(...COLOR.white);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(String(score), x, y + 2, { align: "center" });

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("/100", x, y + 8, { align: "center" });
}

// ─── Player Info Block ────────────────────────────────────────────────────────

function drawPlayerInfoBlock(doc: jsPDF, player: PlayerData, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  const latest = latestSession(player);
  const trend = sgsTrend(player);

  // Info box
  doc.setFillColor(...COLOR.light);
  doc.roundedRect(10, y, w - 20, 22, 2, 2, "F");

  doc.setTextColor(...COLOR.dark);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(player.full_name, 18, y + 9);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR.muted);
  const meta = [
    player.position,
    player.age ? `${player.age} ans` : null,
    `${player.sessions.length} session(s)`,
    latest ? `Dernière: ${fmtDate(latest.date)}` : "Aucune session",
  ]
    .filter(Boolean)
    .join("  •  ");
  doc.text(meta, 18, y + 17);

  // SGS badge
  if (latest) {
    drawSgsBadge(doc, latest.sgs_score, w - 30, y + 12);

    if (trend !== null) {
      const trendStr = trend > 0 ? `▲ +${trend}` : trend < 0 ? `▼ ${trend}` : `= ${trend}`;
      doc.setFontSize(7);
      doc.setTextColor(trend >= 0 ? COLOR.primary[0] : COLOR.accent[0], trend >= 0 ? COLOR.primary[1] : COLOR.accent[1], trend >= 0 ? COLOR.primary[2] : COLOR.accent[2]);
      doc.text(trendStr, w - 30, y + 22, { align: "center" });
    }
  }

  return y + 26;
}

// ─── Session History Table ─────────────────────────────────────────────────────

function drawSessionHistoryTable(doc: jsPDF, player: PlayerData, y: number): number {
  y = drawSectionTitle(doc, "Historique des sessions", y);

  if (player.sessions.length === 0) {
    doc.setTextColor(...COLOR.muted);
    doc.setFontSize(8);
    doc.text("Aucune session enregistrée.", 14, y + 5);
    return y + 10;
  }

  const rows = [...player.sessions].reverse().map((s) => [
    fmtDate(s.date),
    String(s.sgs_score),
    ...s.dimensions.map((d) => String(d.score)),
  ]);

  const headers = [
    "Date",
    "SGS",
    "TR",
    "Inhibition",
    "Mém. travail",
    "Attention",
    "Flexibilité",
    "Anticipation",
  ];
  const w = doc.internal.pageSize.getWidth() - 20;
  const colWidths = [22, 14, 16, 22, 24, 22, 22, 24];

  return drawTable(doc, headers, rows, y, colWidths);
}

// ─── Detailed Annex (per-test metrics) ───────────────────────────────────────

function drawDetailedAnnex(doc: jsPDF, player: PlayerData, y: number): number {
  const latest = latestSession(player);
  if (!latest) return y;

  y = drawSectionTitle(doc, "Annexe détaillée — Dernière session", y);

  // Simon
  y = drawSectionTitle(doc, "Simon Task (Inhibition & Temps de réaction)", y);
  const simonRows = latest.tests.simon.map((m) => [m.metrique, String(m.valeur)]);
  y = drawTable(doc, ["Métrique", "Valeur"], simonRows, y, [80, 40]);

  // N-Back
  y = drawSectionTitle(doc, "N-Back 2 (Mémoire de travail)", y);
  const nbackRows = latest.tests.nback.map((m) => [m.metrique, String(m.valeur)]);
  y = drawTable(doc, ["Métrique", "Valeur"], nbackRows, y, [80, 40]);

  // TMT
  y = drawSectionTitle(doc, "Trail Making Test (Flexibilité cognitive)", y);
  const tmtRows = latest.tests.tmt.map((m) => [m.metrique, String(m.valeur)]);
  y = drawTable(doc, ["Métrique", "Valeur"], tmtRows, y, [80, 40]);

  return y;
}

// ─── Main: Export Single Player ───────────────────────────────────────────────

export async function exportPlayerReport(
  player: PlayerData,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const latest = latestSession(player);

  // ── Page 1: Summary ──────────────────────────────────────────────────────
  drawHeader(
    doc,
    `Rapport Cognitif — ${player.full_name}`,
    `Académie Raja Casablanca | ${fmtDate(new Date().toISOString())}`
  );

  let y = 34;
  y = drawPlayerInfoBlock(doc, player, y);
  y += 4;

  // Dimensions bar chart
  if (latest) {
    y = drawSectionTitle(doc, "Profil cognitif — Dernière session", y);
    y = drawDimensionBars(doc, latest.dimensions, y);
    y += 6;
  }

  // Session history table
  y = drawSessionHistoryTable(doc, player, y);

  // ── Page 2: Detailed Annex ───────────────────────────────────────────────
  if (options.includeAnnex !== false && latest) {
    doc.addPage();
    drawHeader(
      doc,
      `Annexe Détaillée — ${player.full_name}`,
      `Session du ${fmtDate(latest.date)}`
    );
    let y2 = 34;
    y2 = drawDetailedAnnex(doc, player, y2);
  }

  // Footers on all pages
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total);
  }

  doc.save(`CogniRaja_${player.full_name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Main: Export Team Report ─────────────────────────────────────────────────

export async function exportTeamReport(
  players: PlayerData[],
  coachName: string,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  // ── Page 1: Team Overview ─────────────────────────────────────────────────
  drawHeader(doc, "Rapport Équipe — Synthèse Cognitive", `Coach: ${coachName}`);

  let y = 34;
  y = drawSectionTitle(doc, `Récapitulatif de l'équipe (${players.length} joueurs)`, y);

  // Team summary table
  const teamRows = players.map((p) => {
    const s = latestSession(p);
    const trend = sgsTrend(p);
    const trendStr = trend === null ? "—" : trend > 0 ? `+${trend}` : String(trend);
    return [
      p.full_name,
      p.position,
      s ? String(s.sgs_score) : "—",
      trendStr,
      s ? fmtDate(s.date) : "—",
    ];
  });

  y = drawTable(
    doc,
    ["Joueur", "Poste", "SGS", "Tendance", "Dernière session"],
    teamRows,
    y,
    [55, 28, 18, 22, 36]
  );

  y += 6;

  // Dimension averages
  y = drawSectionTitle(doc, "Moyennes par dimension (toute l'équipe)", y);
  const dimLabels = ["TR", "Inhibition", "Mém. travail", "Attention", "Flexibilité", "Anticipation"];
  const dimAvgs: DimensionScore[] = dimLabels.map((label, i) => {
    const vals = players
      .map((p) => latestSession(p)?.dimensions[i]?.score)
      .filter((v): v is number => v !== undefined);
    const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    const percentile = Math.round(
      (vals.filter((v) => v <= avg).length / vals.length) * 100
    );
    return { label, score: avg, percentile };
  });
  y = drawDimensionBars(doc, dimAvgs, y);

  // ── Per-player pages ──────────────────────────────────────────────────────
  for (const player of players) {
    doc.addPage();
    drawHeader(doc, `Profil — ${player.full_name}`, player.position);
    let yp = 34;
    yp = drawPlayerInfoBlock(doc, player, yp);
    yp += 4;

    const latest = latestSession(player);
    if (latest) {
      yp = drawSectionTitle(doc, "Profil cognitif", yp);
      yp = drawDimensionBars(doc, latest.dimensions, yp);
      yp += 4;
    }

    yp = drawSessionHistoryTable(doc, player, yp);

    if (options.includeAnnex !== false && latest) {
      const pageH = doc.internal.pageSize.getHeight();
      if (yp > pageH - 80) {
        doc.addPage();
        drawHeader(doc, `Annexe — ${player.full_name}`, `Session du ${fmtDate(latest.date)}`);
        yp = 34;
      }
      yp = drawDetailedAnnex(doc, player, yp);
    }
  }

  // Footers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total);
  }

  doc.save(`CogniRaja_Equipe_${new Date().toISOString().slice(0, 10)}.pdf`);
}
