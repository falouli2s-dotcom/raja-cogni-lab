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

export interface SimonRawTrial {
  trialNumber: number;
  type: string;          // "Congruent" | "Incongruent"
  stimulus: string;      // "Vert" | "Rouge"
  side: string;          // "Gauche" | "Droite"
  response: string;
  rt: number | null;
  correct: boolean;
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
  simonRawTrials?: SimonRawTrial[];
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

/** Extracts avg_rt (ms) from a session's Simon Task metrics. Returns null if missing. */
function getAvgRT(session: SessionResult | null | undefined): number | null {
  if (!session) return null;
  const m = session.tests.simon.find(
    (x) => x.metrique === "avg_rt" || x.metrique === "avgRT" || x.metrique === "avg_rt_ms"
  );
  if (!m || !Number.isFinite(Number(m.valeur))) return null;
  return Math.round(Number(m.valeur));
}

/** Average avg_rt across players' latest sessions. */
function teamAvgRT(players: PlayerData[]): number | null {
  const vals = players
    .map((p) => getAvgRT(latestSession(p)))
    .filter((v): v is number => v !== null && v > 0);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
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
  // Auto page break — keep title with at least one row of content
  const pageH = doc.internal.pageSize.getHeight();
  if (y + 20 > pageH - 15) {
    doc.addPage();
    y = 15;
  }
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
  startY: number,
  avgRtMs?: number | null
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

    // Inline avg_rt (ms) on the reaction-time row
    const isRtRow =
      dim.label === "TR" ||
      dim.label === "Temps de réaction" ||
      dim.label.toLowerCase().startsWith("temps de réaction");
    if (isRtRow && avgRtMs != null && avgRtMs > 0) {
      doc.setTextColor(55, 65, 81); // dark gray
      doc.setFontSize(7);
      doc.text(`(${avgRtMs} ms)`, w - 28, y + 4, { align: "right" });
    }

    y += 9;
  });

  return y + 4;
}

/** Ensures `needed` mm of vertical space; otherwise starts a new page. Returns the (possibly reset) Y. */
function ensureSpace(doc: jsPDF, y: number, needed: number, topMargin = 15): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 15) {
    doc.addPage();
    return topMargin;
  }
  return y;
}

/** Mini table renderer with automatic page breaks. */
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
  const rowH = 7;
  const pageH = doc.internal.pageSize.getHeight();

  let y = startY;

  const drawHeaderRow = () => {
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
  };

  let sectionStart = y;
  drawHeaderRow();

  rows.forEach((row, ri) => {
    // Page break if next row won't fit
    if (y + rowH > pageH - 15) {
      // Close border on current page
      doc.setDrawColor(...COLOR.border);
      doc.setLineWidth(0.3);
      doc.rect(margin, sectionStart, tableW, y - sectionStart, "S");

      doc.addPage();
      y = 15;
      sectionStart = y;
      drawHeaderRow();
    }

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

  // Final border
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.rect(margin, sectionStart, tableW, y - sectionStart, "S");

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

// ─── Radar Chart (6-axis cognitive profile) ───────────────────────────────────

/**
 * Draws a 6-axis radar chart at (cx, cy) with given radius.
 * scores[i] expected in 0-100, mapped to 0-r.
 * Axis order: Réaction, Inhibition, Mémoire, Attention, Flexibilité, Anticipation.
 */
function drawRadar(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  scores: number[]
): void {
  const labels = ["Réaction", "Inhibition", "Mémoire", "Attention", "Flexibilité", "Anticipation"];
  const n = 6;
  const step = (2 * Math.PI) / n;
  // Start from top (12 o'clock)
  const angleAt = (i: number) => -Math.PI / 2 + i * step;

  // Background polygon (light gray) + concentric guides at 25/50/75/100%
  doc.setDrawColor(229, 231, 235); // #e5e7eb
  doc.setLineWidth(0.2);
  for (const ratio of [0.25, 0.5, 0.75, 1]) {
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = angleAt(i);
      pts.push([cx + Math.cos(a) * r * ratio, cy + Math.sin(a) * r * ratio]);
    }
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % n];
      doc.line(x1, y1, x2, y2);
    }
  }

  // Axis lines
  for (let i = 0; i < n; i++) {
    const a = angleAt(i);
    doc.line(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }

  // Data polygon points
  const dataPts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const s = Math.max(0, Math.min(100, scores[i] ?? 0));
    const a = angleAt(i);
    const dist = (s / 100) * r;
    dataPts.push([cx + Math.cos(a) * dist, cy + Math.sin(a) * dist]);
  }

  // Filled green polygon at opacity 0.4 (using GState)
  const anyDoc = doc as any;
  let gs: any;
  try {
    gs = new (jsPDF as any).GState({ opacity: 0.4 });
    anyDoc.setGState(gs);
  } catch {
    /* GState may be unavailable; fall back to solid fill */
  }
  doc.setFillColor(25, 140, 61); // #198c3d Raja green
  // Use lines() with start point for filled polygon
  const startX = dataPts[0][0];
  const startY = dataPts[0][1];
  const rel: [number, number][] = [];
  for (let i = 1; i < n; i++) {
    rel.push([dataPts[i][0] - dataPts[i - 1][0], dataPts[i][1] - dataPts[i - 1][1]]);
  }
  rel.push([startX - dataPts[n - 1][0], startY - dataPts[n - 1][1]]);
  doc.lines(rel, startX, startY, [1, 1], "F", true);

  // Reset opacity
  try {
    const gs2 = new (jsPDF as any).GState({ opacity: 1 });
    anyDoc.setGState(gs2);
  } catch { /* noop */ }

  // Stroked outline (solid green)
  doc.setDrawColor(25, 140, 61);
  doc.setLineWidth(0.5);
  for (let i = 0; i < n; i++) {
    const [x1, y1] = dataPts[i];
    const [x2, y2] = dataPts[(i + 1) % n];
    doc.line(x1, y1, x2, y2);
  }

  // Score dots
  doc.setFillColor(25, 140, 61);
  for (const [x, y] of dataPts) {
    doc.circle(x, y, 1, "F");
  }

  // Axis labels
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55); // #1f2937
  for (let i = 0; i < n; i++) {
    const a = angleAt(i);
    const lx = cx + Math.cos(a) * (r + 8);
    const ly = cy + Math.sin(a) * (r + 8) + 1;
    let align: "left" | "right" | "center" = "center";
    const cosA = Math.cos(a);
    if (cosA > 0.2) align = "left";
    else if (cosA < -0.2) align = "right";
    doc.text(labels[i], lx, ly, { align });
  }
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

  // Simon raw RT data
  if (latest.simonRawTrials && latest.simonRawTrials.length > 0) {
    y = drawSectionTitle(doc, "Données brutes — Temps de réaction (Simon Task)", y);
    const rawRows = latest.simonRawTrials.map((t) => [
      String(t.trialNumber),
      t.type,
      t.stimulus,
      t.side,
      t.response,
      t.rt != null ? String(t.rt) : "—",
      t.correct ? "✓" : "✗",
    ]);

    // Compute summary
    const valid = latest.simonRawTrials.filter((t) => t.rt != null && t.correct);
    const cong = valid.filter((t) => t.type === "Congruent");
    const inco = valid.filter((t) => t.type === "Incongruent");
    const avg = (arr: SimonRawTrial[]) =>
      arr.length ? Math.round(arr.reduce((s, t) => s + (t.rt ?? 0), 0) / arr.length) : 0;
    const avgC = avg(cong);
    const avgI = avg(inco);
    const effect = avgI - avgC;
    rawRows.push(
      ["", "", "", "", "Avg TR Congruent", `${avgC} ms`, ""],
      ["", "", "", "", "Avg TR Incongruent", `${avgI} ms`, ""],
      ["", "", "", "", "Simon Effect", `${effect} ms`, ""]
    );

    y = drawTable(
      doc,
      ["Essai #", "Type", "Stimulus", "Côté", "Réponse", "TR (ms)", "Correct ?"],
      rawRows,
      y,
      [16, 24, 22, 20, 24, 22, 22]
    );
  }

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

  // Radar chart (6 axes) — between SGS badge and dimension bars
  if (latest) {
    y = drawSectionTitle(doc, "Radar cognitif — 6 dimensions", y);
    const radarCy = y + 42;
    drawRadar(doc, w / 2, radarCy, 35, latest.dimensions.map((d) => d.score));
    y = radarCy + 45;
  }

  // Dimensions bar chart
  if (latest) {
    y = drawSectionTitle(doc, "Profil cognitif — Dernière session", y);
    y = drawDimensionBars(doc, latest.dimensions, y, getAvgRT(latest));
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
