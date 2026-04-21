import type { CognitiveDimension } from "@/lib/sgs-engine";

export interface RadarTheme {
  ring: string;
  ringLabel: string;
  muted: string;
  text: string;
  card: string;
  dotBg: string;
}

export const darkRadarTheme: RadarTheme = {
  ring: "#252e3f",
  ringLabel: "#3d5270",
  muted: "#6882a1",
  text: "#eff3f7",
  card: "#10141c",
  dotBg: "#07090c",
};

export const lightRadarTheme: RadarTheme = {
  ring: "#dde3ec",
  ringLabel: "#94a3b8",
  muted: "#64748b",
  text: "#0f172a",
  card: "#ffffff",
  dotBg: "#f8fafc",
};

interface RadarChartProps {
  dimensions: CognitiveDimension[];
  size?: number;
  theme?: RadarTheme;
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

export function RadarChart({
  dimensions,
  size = 280,
  theme = darkRadarTheme,
}: RadarChartProps) {
  const INDICATORS = dimensions.map((d) => ({
    key: d.key,
    label: d.label,
    weight: (WEIGHTS[d.key] ?? 1 / dimensions.length) * 100,
  }));
  const scores: Record<string, number> = Object.fromEntries(
    dimensions.map((d) => [d.key, d.score])
  );

  const n = INDICATORS.length;
  const cx = 200;
  const cy = 200;
  const maxR = 140;
  const rings = [20, 40, 60, 80, 100];
  const angles = INDICATORS.map((_, i) => (360 / n) * i);

  const dataPoints = INDICATORS.map((ind, i) => {
    const r = (scores[ind.key] / 100) * maxR;
    return polarToXY(angles[i], r, cx, cy);
  });

  const dataPath =
    dataPoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ") + " Z";
  const axisPoints = INDICATORS.map((_, i) =>
    polarToXY(angles[i], maxR, cx, cy)
  );

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

      {/* Axis lines */}
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

      {/* Data area */}
      <path
        d={dataPath}
        fill="rgba(25, 140, 61, 0.15)"
        stroke="#198c3d"
        strokeWidth="2"
        strokeLinejoin="round"
        style={{
          filter: "drop-shadow(0 0 8px rgba(25,140,61,0.4))",
          transition: "all 0.6s ease",
        }}
      />

      {/* Data points */}
      {dataPoints.map((p, i) => {
        const level = getLevel(scores[INDICATORS[i].key]);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={8} fill={level.color} opacity={0.15} />
            <circle
              cx={p.x}
              cy={p.y}
              r={5}
              fill={theme.dotBg}
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
        const level = getLevel(scores[ind.key]);
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
              {scores[ind.key]}
            </text>
          </g>
        );
      })}

      {/* Center SGS */}
      <circle
        cx={cx}
        cy={cy}
        r={28}
        fill={theme.card}
        stroke={theme.ring}
        strokeWidth="1"
      />
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
        {Math.round(
          INDICATORS.reduce(
            (s, ind) => s + (scores[ind.key] * ind.weight) / 100,
            0
          )
        )}
      </text>
    </svg>
  );
}
