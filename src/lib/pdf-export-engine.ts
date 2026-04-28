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

// ─── Cognitive Radar (CogniLab style — SVG → PNG → embedded) ─────────────────

/**
 * Six axes in fixed order, matching the order produced by export-fetcher:
 *   [reactionTime, inhibition, workingMemory, attention, flexibility, anticipation]
 * Labels mirror the CogniLab report (sgs-engine).
 */
const RADAR_AXIS_LABELS = [
  "Temps de Réaction",
  "Contrôle Inhibiteur",
  "Mémoire de Travail",
  "Attention Sélective",
  "Flexibilité Cognitive",
  "Anticipation Perceptuelle",
];

function radarLevelColor(score: number): string {
  if (score >= 75) return "#16a34a";
  if (score >= 50) return "#198c3d";
  if (score >= 30) return "#d97706";
  return "#dc2626";
}

/**
 * Builds a self-contained SVG string of the CogniLab cognitive radar.
 * Uses absolute hex colors and inline font-families — safe for canvas rasterization.
 */
function buildCognitiveRadarSvg(scores: number[], sgsScore: number): string {
  const cx = 200;
  const cy = 200;
  const maxR = 140;
  const n = 6;
  const angles = Array.from({ length: n }, (_, i) => (360 / n) * i);
  const polar = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const ringPcts = [20, 40, 60, 80, 100];

  // Concentric rings + their numeric labels
  let rings = "";
  for (const pct of ringPcts) {
    const r = (pct / 100) * maxR;
    const pts = angles.map((a) => polar(a, r));
    const path =
      pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
    rings += `<path d="${path}" fill="none" stroke="#dde3ec" stroke-width="1"/>`;
    rings += `<text x="${cx + 4}" y="${cy - r + 4}" fill="#94a3b8" font-size="8" font-family="monospace">${pct}</text>`;
  }

  // Axis lines
  let axes = "";
  for (let i = 0; i < n; i++) {
    const p = polar(angles[i], maxR);
    axes += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="#dde3ec" stroke-width="1" stroke-dasharray="3,3"/>`;
  }

  // Data polygon
  const dataPts = scores.slice(0, n).map((s, i) => {
    const v = Math.max(0, Math.min(100, s ?? 0));
    return polar(angles[i], (v / 100) * maxR);
  });
  const dataPath =
    dataPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // Data dots (single-series, color by level)
  let dots = "";
  for (let i = 0; i < n; i++) {
    const s = scores[i] ?? 0;
    const color = radarLevelColor(s);
    const p = dataPts[i];
    dots += `
      <circle cx="${p.x}" cy="${p.y}" r="8" fill="${color}" opacity="0.15"/>
      <circle cx="${p.x}" cy="${p.y}" r="5" fill="#f8fafc" stroke="${color}" stroke-width="2"/>
      <circle cx="${p.x}" cy="${p.y}" r="2.5" fill="${color}"/>`;
  }

  // Axis labels (name + numeric value)
  let labels = "";
  for (let i = 0; i < n; i++) {
    const lp = polar(angles[i], maxR + 32);
    const anchor =
      Math.abs(lp.x - cx) < 10 ? "middle" : lp.x < cx ? "end" : "start";
    const score = Math.round(scores[i] ?? 0);
    const color = radarLevelColor(score);
    const name = RADAR_AXIS_LABELS[i] ?? "";
    labels += `
      <text x="${lp.x}" y="${lp.y}" text-anchor="${anchor}" dominant-baseline="middle"
            fill="#475569" font-size="10" font-family="Inter, Arial, sans-serif" font-weight="600">${name}</text>
      <text x="${lp.x}" y="${lp.y + 12}" text-anchor="${anchor}" dominant-baseline="middle"
            fill="${color}" font-size="11" font-family="monospace" font-weight="700">${score}</text>`;
  }

  // Center SGS chip
  const center = `
    <circle cx="${cx}" cy="${cy}" r="28" fill="#ffffff" stroke="#dde3ec" stroke-width="1"/>
    <text x="${cx}" y="${cy - 7}" text-anchor="middle" fill="#475569"
          font-size="7" font-family="Inter, Arial, sans-serif" font-weight="600" letter-spacing="1">SGS</text>
    <text x="${cx}" y="${cy + 9}" text-anchor="middle" fill="#0f172a"
          font-size="18" font-family="monospace" font-weight="700">${Math.round(sgsScore)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="600" height="600">
    <rect width="400" height="400" fill="#ffffff"/>
    ${rings}
    ${axes}
    <path d="${dataPath}" fill="rgba(25,140,61,0.25)" stroke="#198c3d" stroke-width="2" stroke-linejoin="round"/>
    ${dots}
    ${labels}
    ${center}
  </svg>`;
}

/** Rasterizes an SVG string to a PNG data URL via an offscreen canvas. */
async function svgToPngDataUrl(svg: string, pxSize = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = pxSize;
        canvas.height = pxSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pxSize, pxSize);
        ctx.drawImage(img, 0, 0, pxSize, pxSize);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Async helper: renders the CogniLab radar at (cx, cy) with given mm radius.
 * Replaces the previous vector drawRadar() with the rich CogniLab visual.
 */
async function drawCognitiveRadar(
  doc: jsPDF,
  cx: number,
  cy: number,
  rMm: number,
  scores: number[],
  sgsScore: number
): Promise<void> {
  const svg = buildCognitiveRadarSvg(scores, sgsScore);
  const png = await svgToPngDataUrl(svg, 700);
  // Render larger than rMm to include axis labels + center chip; SVG viewBox 400 ≈ 2*(maxR+padding)
  const sizeMm = rMm * 2.6;
  doc.addImage(png, "PNG", cx - sizeMm / 2, cy - sizeMm / 2, sizeMm, sizeMm);
}


// ─── Team SGS Evolution (line chart) ─────────────────────────────────────────

/**
 * Draws a line chart of the team-average SGS over time.
 * Aggregates ALL sessions across players, groups by day, averages SGS.
 */
function drawTeamSgsTrend(
  doc: jsPDF,
  players: PlayerData[],
  startY: number
): number {
  const buckets = new Map<string, number[]>();
  for (const p of players) {
    for (const s of p.sessions) {
      if (!s.date || !Number.isFinite(Number(s.sgs_score))) continue;
      const day = s.date.slice(0, 10);
      if (!buckets.has(day)) buckets.set(day, []);
      buckets.get(day)!.push(Number(s.sgs_score));
    }
  }

  const points = Array.from(buckets.entries())
    .map(([day, vals]) => ({
      day,
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  if (points.length === 0) {
    doc.setTextColor(...COLOR.muted);
    doc.setFontSize(8);
    doc.text("Aucune donnée d'évolution disponible.", 14, startY + 5);
    return startY + 12;
  }

  const w = doc.internal.pageSize.getWidth();
  const margin = 14;
  const chartX = margin + 16;
  const chartW = w - margin * 2 - 18;
  const chartH = 50;
  const chartY = startY;
  const chartBottom = chartY + chartH;

  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.rect(chartX, chartY, chartW, chartH, "S");

  // Y-axis gridlines + labels (0/25/50/75/100)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR.muted);
  for (const v of [0, 25, 50, 75, 100]) {
    const yy = chartBottom - (v / 100) * chartH;
    if (v !== 0 && v !== 100) {
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.15);
      doc.line(chartX, yy, chartX + chartW, yy);
    }
    doc.text(String(v), chartX - 2, yy + 1.5, { align: "right" });
  }

  const n = points.length;
  const xAt = (i: number) =>
    n === 1 ? chartX + chartW / 2 : chartX + (i / (n - 1)) * chartW;
  const yAt = (v: number) => chartBottom - (Math.max(0, Math.min(100, v)) / 100) * chartH;

  // Line
  doc.setDrawColor(0, 128, 64);
  doc.setLineWidth(0.8);
  for (let i = 0; i < n - 1; i++) {
    doc.line(xAt(i), yAt(points[i].avg), xAt(i + 1), yAt(points[i + 1].avg));
  }
  // Dots
  doc.setFillColor(0, 128, 64);
  for (let i = 0; i < n; i++) {
    doc.circle(xAt(i), yAt(points[i].avg), 1.2, "F");
  }
  // Value labels
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR.dark);
  for (let i = 0; i < n; i++) {
    doc.text(String(points[i].avg), xAt(i), yAt(points[i].avg) - 2, { align: "center" });
  }

  // X-axis date labels (max ~6)
  const maxLabels = Math.min(n, 6);
  const stride = Math.max(1, Math.ceil(n / maxLabels));
  doc.setFontSize(6);
  doc.setTextColor(...COLOR.muted);
  for (let i = 0; i < n; i += stride) {
    doc.text(fmtDate(points[i].day), xAt(i), chartBottom + 4, { align: "center" });
  }
  if ((n - 1) % stride !== 0) {
    doc.text(fmtDate(points[n - 1].day), xAt(n - 1), chartBottom + 4, { align: "center" });
  }

  return chartBottom + 8;
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
    const rt = getAvgRT(s);
    return [
      p.full_name,
      p.position,
      s ? String(s.sgs_score) : "—",
      rt != null ? `${rt} ms` : "—",
      trendStr,
      s ? fmtDate(s.date) : "—",
    ];
  });

  y = drawTable(
    doc,
    ["Joueur", "Poste", "SGS", "TR (ms)", "Tendance", "Dernière session"],
    teamRows,
    y,
    [48, 26, 16, 20, 20, 32]
  );

  y += 6;

  // Team SGS evolution (line chart)
  y = drawSectionTitle(doc, "Évolution du SGS moyen équipe", y);
  y = drawTeamSgsTrend(doc, players, y);
  y += 4;

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
  y = drawDimensionBars(doc, dimAvgs, y, teamAvgRT(players));

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
      yp = drawDimensionBars(doc, latest.dimensions, yp, getAvgRT(latest));
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
