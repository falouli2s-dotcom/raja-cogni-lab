import { useEffect, useState } from "react";
import type { CognitiveDimension } from "@/lib/sgs-engine";

export interface RadarTheme {
  ring: string;
  ringLabel: string;
  muted: string;
  text: string;
  card: string;
  dotBg: string;
}

export const lightRadarTheme: RadarTheme = {
  ring: "#dde3ec",
  ringLabel: "#94a3b8",
  muted: "#475569",
  text: "#0f172a",
  card: "#ffffff",
  dotBg: "#f8fafc",
};

export const darkRadarTheme: RadarTheme = {
  ring: "rgba(255,255,255,0.18)",
  ringLabel: "rgba(229,231,235,0.7)",
  muted: "#E5E7EB",
  text: "#f8fafc",
  card: "#10141c",
  dotBg: "#07090c",
};

export interface RadarOverlay {
  dimensions: CognitiveDimension[];
  color: string; // stroke / fill base color (hex or rgb)
  label?: string;
}

interface RadarChartProps {
  dimensions?: CognitiveDimension[];
  size?: number;
  theme?: RadarTheme;
  /** When provided, renders multiple overlapping series and hides the center SGS / data dots */
  overlays?: RadarOverlay[];
}

// Scientific weights matching sgs-engine WEIGHTS (sum = 1.0)
const WEIGHTS: Record<string, number> = {
  flexibility: 0.25,
  attention: 0.2,
  workingMemory: 0.2,
  inhibition: 0.15,
  reactionTime: 0.1,
  anticipation: 0.1,
};

function polarToXY(angleDeg: number, r: number, cx: number, cy: number) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function getLevel(score: number): { color: string } {
  if (score >= 75) return { color: "#16a34a" };
  if (score >= 50) return { color: "#198c3d" };
  if (score >= 30) return { color: "#d97706" };
  return { color: "#dc2626" };
}

/** Detect active dark mode via the `dark` class on <html>. */
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export function RadarChart({
  dimensions,
  size = 280,
  theme,
  overlays,
}: RadarChartProps) {
  const isDark = useIsDark();
  const resolvedTheme: RadarTheme = theme ?? (isDark ? darkRadarTheme : lightRadarTheme);

  // Determine the indicator set (use first overlay if comparing)
  const baseDims = dimensions ?? overlays?.[0]?.dimensions ?? [];
  if (baseDims.length === 0) return null;

  const INDICATORS = baseDims.map((d) => ({
    key: d.key,
    label: d.label,
    weight: (WEIGHTS[d.key] ?? 1 / baseDims.length) * 100,
  }));

  const n = INDICATORS.length;
  const cx = 200;
  const cy = 200;
  const maxR = 140;
  const rings = [20, 40, 60, 80, 100];
  const angles = INDICATORS.map((_, i) => (360 / n) * i);
  const axisPoints = INDICATORS.map((_, i) => polarToXY(angles[i], maxR, cx, cy));

  // Single-series scores (used for labels and dots when not in compare mode)
  const scores: Record<string, number> = Object.fromEntries(
    baseDims.map((d) => [d.key, d.score])
  );

  function buildPath(dims: CognitiveDimension[]) {
    const pts = INDICATORS.map((ind, i) => {
      const score = dims.find((d) => d.key === ind.key)?.score ?? 0;
      const r = (score / 100) * maxR;
      return polarToXY(angles[i], r, cx, cy);
    });
    return {
      path:
        pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z",
      pts,
    };
  }

  const isCompare = !!overlays && overlays.length > 0;

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      style={{ overflow: "visible", background: "transparent" }}
      className="mx-auto"
    >
      {/* Rings */}
      {rings.map((pct) => {
        const r = (pct / 100) * maxR;
        const ringPoints = angles.map((a) => polarToXY(a, r, cx, cy));
        const ringPath =
          ringPoints
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ") + " Z";
        return (
          <g key={pct}>
            <path
              d={ringPath}
              fill="none"
              stroke={resolvedTheme.ring}
              strokeWidth="1"
            />
            <text
              x={cx + 4}
              y={cy - r + 4}
              fill={resolvedTheme.ringLabel}
              fontSize="8"
              fontFamily="'DM Mono', monospace"
            >
              {pct}
            </text>
          </g>
        );
      })}

      {/* Axis lines */}
      {axisPoints.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke={resolvedTheme.ring}
          strokeWidth="1"
          strokeDasharray="3,3"
        />
      ))}

      {/* Data area(s) */}
      {isCompare ? (
        overlays!.map((ov, idx) => {
          const { path } = buildPath(ov.dimensions);
          return (
            <path
              key={idx}
              d={path}
              fill={ov.color}
              fillOpacity={0.25}
              stroke={ov.color}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          );
        })
      ) : (
        <path
          d={buildPath(baseDims).path}
          fill="rgba(25, 140, 61, 0.15)"
          stroke="#198c3d"
          strokeWidth="2"
          strokeLinejoin="round"
          style={{
            filter: "drop-shadow(0 0 8px rgba(25,140,61,0.4))",
            transition: "all 0.6s ease",
          }}
        />
      )}

      {/* Data points (single-series only) */}
      {!isCompare &&
        INDICATORS.map((ind, i) => {
          const r = (scores[ind.key] / 100) * maxR;
          const p = polarToXY(angles[i], r, cx, cy);
          const level = getLevel(scores[ind.key]);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={8} fill={level.color} opacity={0.15} />
              <circle
                cx={p.x}
                cy={p.y}
                r={5}
                fill={resolvedTheme.dotBg}
                stroke={level.color}
                strokeWidth="2"
              />
              <circle cx={p.x} cy={p.y} r={2.5} fill={level.color} />
            </g>
          );
        })}

      {/* Labels */}
      {INDICATORS.map((ind, i) => {
        const labelPos = polarToXY(angles[i], maxR + 32, cx, cy);
        const lines = ind.label.split("\n");
        const anchor =
          Math.abs(labelPos.x - cx) < 10
            ? "middle"
            : labelPos.x < cx
              ? "end"
              : "start";
        return (
          <g key={i}>
            {lines.map((line, li) => (
              <text
                key={li}
                x={labelPos.x}
                y={labelPos.y + li * 11 - (lines.length - 1) * 5}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill={resolvedTheme.muted}
                fontSize="9"
                fontFamily="'Inter', sans-serif"
                fontWeight="600"
              >
                {line}
              </text>
            ))}
            {!isCompare && (
              <text
                x={labelPos.x}
                y={labelPos.y + lines.length * 11 - (lines.length - 1) * 5}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill={getLevel(scores[ind.key]).color}
                fontSize="11"
                fontFamily="'DM Mono', monospace"
                fontWeight="700"
              >
                {scores[ind.key]}
              </text>
            )}
          </g>
        );
      })}

      {/* Center SGS (only single-series) */}
      {!isCompare && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={28}
            fill={resolvedTheme.card}
            stroke={resolvedTheme.ring}
            strokeWidth="1"
          />
          <text
            x={cx}
            y={cy - 7}
            textAnchor="middle"
            fill={resolvedTheme.muted}
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
            fill={resolvedTheme.text}
            fontSize="16"
            fontFamily="'DM Mono', monospace"
            fontWeight="700"
          >
            {Math.round(
              INDICATORS.reduce(
                (s, ind) => s + (scores[ind.key] * ind.weight) / 100,
                0
              )
            )}
          </text>
        </>
      )}
    </svg>
  );
}
