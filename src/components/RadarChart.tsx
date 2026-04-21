import type { CognitiveDimension } from "@/lib/sgs-engine";
import { motion } from "framer-motion";

interface RadarChartProps {
  dimensions: CognitiveDimension[];
  size?: number;
}

export function RadarChart({ dimensions, size = 280 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const levels = [25, 50, 75, 100];
  const n = dimensions.length;

  function polarToCartesian(angle: number, r: number) {
    const a = (angle - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function getAngle(i: number) {
    return (360 / n) * i;
  }

  // Grid polygons
  const gridPolygons = levels.map((level) => {
    const r = (level / 100) * radius;
    const points = Array.from({ length: n }, (_, i) => {
      const p = polarToCartesian(getAngle(i), r);
      return `${p.x},${p.y}`;
    }).join(" ");
    return points;
  });

  // Data polygon
  const dataPoints = dimensions.map((d, i) => {
    const r = (d.score / 100) * radius;
    return polarToCartesian(getAngle(i), r);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Label positions
  const labels = dimensions.map((d, i) => {
    const p = polarToCartesian(getAngle(i), radius + 24);
    return { ...p, label: d.label, score: d.score };
  });

  // Grid level labels (top-right of each ring, along axis at -45° from top)
  const levelLabelAngle = 45;
  const levelLabels = levels.map((level) => {
    const r = (level / 100) * radius;
    const p = polarToCartesian(levelLabelAngle, r);
    return { ...p, level };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      <defs>
        <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.35)" />
          <stop offset="100%" stopColor="hsl(var(--primary) / 0.05)" />
        </radialGradient>
        <filter id="radarShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodColor="hsl(var(--primary))"
            floodOpacity="0.4"
          />
        </filter>
      </defs>

      {/* Grid */}
      {gridPolygons.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={i === levels.length - 1 ? 1.5 : 0.5}
          opacity={0.5}
        />
      ))}

      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const p = polarToCartesian(getAngle(i), radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
            strokeDasharray="4 3"
            opacity={0.3}
          />
        );
      })}

      {/* Grid level labels */}
      {levelLabels.map((l, i) => (
        <text
          key={i}
          x={l.x + 4}
          y={l.y - 2}
          textAnchor="start"
          dominantBaseline="central"
          className="fill-muted-foreground"
          style={{ fontSize: "8px" }}
          opacity={0.6}
        >
          {l.level}
        </text>
      ))}

      {/* Data area group with entrance animation */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <polygon
          points={dataPolygon}
          fill="url(#radarGradient)"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          strokeLinejoin="round"
          filter="url(#radarShadow)"
        />

        {/* Data points with halo */}
        {dataPoints.map((p, i) => (
          <g key={i}>
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={9}
              fill="hsl(var(--primary) / 0.15)"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
              style={{ transformOrigin: `${p.x}px ${p.y}px` }}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={5}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth={2}
            />
          </g>
        ))}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill="hsl(var(--primary) / 0.4)" />
      </motion.g>

      {/* Labels — name + score */}
      {labels.map((l, i) => (
        <g key={i}>
          <text
            x={l.x}
            y={l.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground font-medium"
            style={{ fontSize: "10px" }}
          >
            {l.label}
          </text>
          <text
            x={l.x}
            y={l.y}
            dy={13}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-primary font-bold"
            style={{ fontSize: "11px" }}
          >
            {l.score}
          </text>
        </g>
      ))}
    </svg>
  );
}
