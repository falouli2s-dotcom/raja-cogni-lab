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

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
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
            opacity={0.5}
          />
        );
      })}

      {/* Data area */}
      <motion.polygon
        points={dataPolygon}
        fill="hsl(var(--primary) / 0.15)"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="hsl(var(--primary))"
          stroke="hsl(var(--background))"
          strokeWidth={2}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 + i * 0.05 }}
        />
      ))}

      {/* Labels */}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground text-[10px] font-medium"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}
