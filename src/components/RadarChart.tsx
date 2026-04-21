import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import type { CognitiveDimension } from "@/lib/sgs-engine";

interface RadarChartProps {
  dimensions: CognitiveDimension[];
  size?: number;
}

const INDICATORS = [
  { key: "flexibility", label: "Flexibilité\nCognitive", weight: 25 },
  { key: "attention", label: "Attention\nSélective", weight: 20 },
  { key: "workingMemory", label: "Mémoire de\nTravail", weight: 20 },
  { key: "inhibition", label: "Contrôle\nInhibiteur", weight: 15 },
  { key: "reactionTime", label: "Temps de\nRéaction", weight: 10 },
  { key: "anticipation", label: "Anticipation\nPerceptuelle", weight: 10 },
] as const;

type ThemeT = {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  ring: string;
  ringLabel: string;
};

function getLevel(score: number) {
  if (score >= 75) return { label: "Élevé", color: "#22c55e" };
  if (score >= 50) return { label: "Moyen", color: "#f59e0b" };
  return { label: "Faible", color: "#ef4444" };
}

function polarToXY(angle: number, r: number, cx: number, cy: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function InnerRadar({
  scores,
  theme,
  animated,
}: {
  scores: Record<string, number>;
  theme: ThemeT;
  animated: boolean;
}) {
  const n = INDICATORS.length;
  const cx = 200,
    cy = 200,
    maxR = 140;
  const rings = [20, 40, 60, 80, 100];
  const angles = INDICATORS.map((_, i) => (360 / n) * i);
  const dataPoints = INDICATORS.map((ind, i) => {
    const r = ((scores[ind.key] ?? 0) / 100) * maxR;
    return polarToXY(angles[i], r, cx, cy);
  });
  const dataPath =
    dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  const axisPoints = INDICATORS.map((_, i) => polarToXY(angles[i], maxR, cx, cy));
  const sgs = Math.round(
    INDICATORS.reduce((sum, ind) => sum + ((scores[ind.key] ?? 0) * ind.weight) / 100, 0)
  );

  return (
    <svg viewBox="0 0 400 400" width="100%" height="100%" style={{ overflow: "visible" }}>
      {rings.map((pct) => {
        const r = (pct / 100) * maxR;
        const ringPoints = angles.map((a) => polarToXY(a, r, cx, cy));
        const ringPath =
          ringPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
        return (
          <g key={pct}>
            <path d={ringPath} fill="none" stroke={theme.ring} strokeWidth="1" />
            <text
              x={cx + 4}
              y={cy - r + 4}
              fill={theme.ringLabel}
              fontSize="8"
              fontFamily="'DM Mono', monospace"
            >
              {pct}
            </text>
          </g>
        );
      })}
      {axisPoints.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke={theme.ring}
          strokeWidth="1"
          strokeDasharray="3,3"
        />
      ))}
      <path
        d={dataPath}
        fill="rgba(25, 140, 61, 0.15)"
        stroke="#198c3d"
        strokeWidth="2"
        strokeLinejoin="round"
        style={{
          filter: "drop-shadow(0 0 8px rgba(25,140,61,0.4))",
          transition: animated ? "all 0.6s ease" : "none",
        }}
      />
      {dataPoints.map((p, i) => {
        const score = scores[INDICATORS[i].key] ?? 0;
        const level = getLevel(score);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5} fill={theme.bg} stroke={level.color} strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r={2.5} fill={level.color} />
          </g>
        );
      })}
      {INDICATORS.map((ind, i) => {
        const labelPos = polarToXY(angles[i], maxR + 32, cx, cy);
        const lines = ind.label.split("\n");
        const score = scores[ind.key] ?? 0;
        const level = getLevel(score);
        const anchor =
          Math.abs(labelPos.x - cx) < 10 ? "middle" : labelPos.x < cx ? "end" : "start";
        return (
          <g key={i}>
            {lines.map((line, li) => (
              <text
                key={li}
                x={labelPos.x}
                y={labelPos.y + li * 11 - (lines.length - 1) * 5}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill={theme.muted}
                fontSize="9"
                fontFamily="'Inter', sans-serif"
                fontWeight="500"
              >
                {line}
              </text>
            ))}
            <text
              x={labelPos.x}
              y={labelPos.y + lines.length * 11 - (lines.length - 1) * 5}
              textAnchor={anchor}
              dominantBaseline="middle"
              fill={level.color}
              fontSize="11"
              fontFamily="'DM Mono', monospace"
              fontWeight="700"
            >
              {score}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={28} fill={theme.card} stroke={theme.ring} strokeWidth="1" />
      <text
        x={cx}
        y={cy - 7}
        textAnchor="middle"
        fill={theme.muted}
        fontSize="7"
        fontFamily="'Inter', sans-serif"
        fontWeight="600"
        letterSpacing="1"
      >
        SGS
      </text>
      <text
        x={cx}
        y={cy + 7}
        textAnchor="middle"
        fill={theme.text}
        fontSize="16"
        fontFamily="'DM Mono', monospace"
        fontWeight="700"
      >
        {sgs}
      </text>
    </svg>
  );
}

export function RadarChart({ dimensions, size = 380 }: RadarChartProps) {
  const [isDark, setIsDark] = useState(true);
  const [activeIndicator, setActiveIndicator] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Build scores from incoming dimensions (by key)
  const initialScores: Record<string, number> = {};
  for (const ind of INDICATORS) {
    const found = dimensions.find((d) => d.key === ind.key);
    initialScores[ind.key] = found ? found.score : 0;
  }

  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [draftScores, setDraftScores] = useState<Record<string, number>>(initialScores);

  // Re-sync when dimensions prop changes
  const dimsKey = dimensions.map((d) => `${d.key}:${d.score}`).join("|");
  const lastDimsKey = useRefValue(dimsKey);
  if (lastDimsKey.current !== dimsKey) {
    lastDimsKey.current = dimsKey;
    const next: Record<string, number> = {};
    for (const ind of INDICATORS) {
      const found = dimensions.find((d) => d.key === ind.key);
      next[ind.key] = found ? found.score : 0;
    }
    setScores(next);
    setDraftScores(next);
  }

  const theme: ThemeT = isDark
    ? {
        bg: "#07090c",
        card: "#10141c",
        border: "#252e3f",
        text: "#eff3f7",
        muted: "#6882a1",
        ring: "#252e3f",
        ringLabel: "#3d5270",
      }
    : {
        bg: "#f0f4f8",
        card: "#ffffff",
        border: "#dde3ec",
        text: "#0f172a",
        muted: "#64748b",
        ring: "#dde3ec",
        ringLabel: "#94a3b8",
      };

  const sgs = Math.round(
    INDICATORS.reduce((sum, ind) => sum + ((scores[ind.key] ?? 0) * ind.weight) / 100, 0)
  );
  const sgsLevel = getLevel(sgs);
  const weakest = [...INDICATORS].sort((a, b) => (scores[a.key] ?? 0) - (scores[b.key] ?? 0))[0];
  const strongest = [...INDICATORS].sort((a, b) => (scores[b.key] ?? 0) - (scores[a.key] ?? 0))[0];

  return (
    <div
      style={{
        background: theme.bg,
        fontFamily: "'Inter', sans-serif",
        color: theme.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px 12px",
        borderRadius: 16,
        width: "100%",
        maxWidth: size + 100,
        margin: "0 auto",
        transition: "background 0.3s ease, color 0.3s ease",
      }}
    >
      {/* Header with toggle */}
      <div style={{ width: "100%", maxWidth: 480, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                color: theme.muted,
                letterSpacing: "2px",
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              RAJA COGNI LAB · RAPPORT
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: theme.text,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Profil Cognitif
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setIsDark(!isDark)}
              aria-label={isDark ? "Activer le mode clair" : "Activer le mode sombre"}
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: 10,
                padding: 8,
                cursor: "pointer",
                color: theme.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: 12,
                padding: "8px 14px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 9, color: theme.muted, letterSpacing: "1px", marginBottom: 2 }}>
                SGS
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: sgsLevel.color,
                  fontFamily: "'DM Mono', monospace",
                  lineHeight: 1,
                }}
              >
                {sgs}
              </div>
              <div style={{ fontSize: 9, color: sgsLevel.color, marginTop: 2, fontWeight: 600 }}>
                {sgsLevel.label}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Radar */}
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: 20,
          padding: "20px",
          marginBottom: 16,
        }}
      >
        <div style={{ width: "100%", aspectRatio: "1" }}>
          <InnerRadar scores={scores} theme={theme} animated />
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { label: "Élevé ≥75", color: "#22c55e" },
          { label: "Moyen 50–74", color: "#f59e0b" },
          { label: "Faible <50", color: "#ef4444" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
            <span style={{ fontSize: 10, color: theme.muted }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Indicator cards */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {INDICATORS.map((ind) => {
          const score = scores[ind.key] ?? 0;
          const level = getLevel(score);
          return (
            <div
              key={ind.key}
              style={{
                background: theme.card,
                border: `1px solid ${activeIndicator === ind.key ? "#198c3d" : theme.border}`,
                borderRadius: 12,
                padding: "10px 12px",
                cursor: "pointer",
                transition: "border-color 0.2s",
              }}
              onClick={() => setActiveIndicator(activeIndicator === ind.key ? null : ind.key)}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 10, color: theme.muted, fontWeight: 600 }}>
                  {ind.label.replace("\n", " ")}
                </span>
                <span style={{ fontSize: 9, color: theme.ringLabel }}>{ind.weight}%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: level.color,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {score}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      height: 4,
                      background: theme.ring,
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${score}%`,
                        height: "100%",
                        background: level.color,
                        borderRadius: 2,
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 9, color: level.color, marginTop: 3, fontWeight: 600 }}>
                    {level.label}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Insight strip */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, borderRight: `1px solid ${theme.border}`, paddingRight: 12 }}>
          <div style={{ fontSize: 9, color: theme.muted, marginBottom: 4, letterSpacing: "1px" }}>
            ⬆ POINT FORT
          </div>
          <div style={{ fontSize: 11, color: theme.text, fontWeight: 600 }}>
            {strongest.label.replace("\n", " ")}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#22c55e",
              fontFamily: "'DM Mono', monospace",
              fontWeight: 700,
            }}
          >
            {scores[strongest.key] ?? 0}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: theme.muted, marginBottom: 4, letterSpacing: "1px" }}>
            ⬇ À TRAVAILLER
          </div>
          <div style={{ fontSize: 11, color: theme.text, fontWeight: 600 }}>
            {weakest.label.replace("\n", " ")}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#ef4444",
              fontFamily: "'DM Mono', monospace",
              fontWeight: 700,
            }}
          >
            {scores[weakest.key] ?? 0}
          </div>
        </div>
      </div>

      {/* Edit panel */}
      <div style={{ width: "100%", maxWidth: 480 }}>
        <button
          onClick={() => {
            setEditing(!editing);
            setDraftScores(scores);
          }}
          style={{
            width: "100%",
            background: editing ? theme.ring : "transparent",
            border: `1px solid ${theme.border}`,
            borderRadius: 10,
            padding: "10px",
            color: theme.muted,
            fontSize: 11,
            cursor: "pointer",
            marginBottom: editing ? 12 : 0,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {editing ? "✕ Fermer la simulation" : "⚙ Simuler des scores"}
        </button>
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {INDICATORS.map((ind) => (
              <div key={ind.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 10, color: theme.muted, width: 100, flexShrink: 0 }}>
                  {ind.label.replace("\n", " ")}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={draftScores[ind.key] ?? 0}
                  onChange={(e) => {
                    const next = { ...draftScores, [ind.key]: +e.target.value };
                    setDraftScores(next);
                    setScores(next);
                  }}
                  style={{ flex: 1, accentColor: "#198c3d" }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: theme.text,
                    fontFamily: "'DM Mono', monospace",
                    width: 28,
                  }}
                >
                  {draftScores[ind.key] ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Tiny helper to keep a mutable value across renders without useEffect
function useRefValue<T>(initial: T) {
  const [ref] = useState<{ current: T }>({ current: initial });
  return ref;
}
