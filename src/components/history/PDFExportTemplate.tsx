import { forwardRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Dot,
} from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { RadarChart, type RadarOverlay } from "@/components/RadarChart";
import type { SGSResult, CognitiveDimension } from "@/lib/sgs-engine";

export interface SessionGroup {
  groupId: string;
  date: string;
  testTypes: string[];
  sgs: SGSResult;
}

export interface DimStat {
  key: string;
  label: string;
  best: number;
  last: number;
  trend: "up" | "down" | "stable";
}

interface PDFExportTemplateProps {
  groups: SessionGroup[];
  dimStats: DimStat[];
  latestRadar: CognitiveDimension[];
  userName?: string;
  exportDate: string;
  // New optional props
  exportMode?: "single" | "comparison";
  selectedSession?: SessionGroup;
  sessionA?: SessionGroup;
  sessionB?: SessionGroup;
  radarA?: CognitiveDimension[];
  radarB?: CognitiveDimension[];
}

// Hex-only colors for print (no oklch)
const RAJA_RED = "#c8102e";
const COMPARE_BLUE = "#2563eb";
const TEXT = "#1a1a1a";
const MUTED = "#666666";
const BORDER = "#e5e5e5";
const ROW_ALT = "#f9f9f9";

function scoreColor(v: number) {
  if (v > 70) return "#16a34a";
  if (v >= 40) return "#d97706";
  return "#dc2626";
}

function statusLabel(v: number) {
  if (v > 70) return "Excellent";
  if (v >= 40) return "À développer";
  return "Faible";
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: RAJA_RED,
  borderBottom: `1px solid ${BORDER}`,
  paddingBottom: 6,
  marginTop: 28,
  marginBottom: 16,
};

export const PDFExportTemplate = forwardRef<HTMLDivElement, PDFExportTemplateProps>(
  function PDFExportTemplate(
    {
      groups,
      dimStats,
      latestRadar,
      userName,
      exportDate,
      exportMode = "single",
      selectedSession,
      sessionA,
      sessionB,
      radarA,
      radarB,
    },
    ref
  ) {
    const isCompare = exportMode === "comparison" && !!sessionA && !!sessionB && !!radarA && !!radarB;

    // SGS shown in section 1: most recent session (Session A in compare mode)
    const headlineSession = isCompare ? sessionA! : (selectedSession ?? groups[0]);
    const sgsValue = headlineSession?.sgs.global ?? 0;

    const chartData = [...groups]
      .slice(0, 10)
      .reverse()
      .map((g) => ({
        date: format(new Date(g.date), "dd/MM"),
        score: g.sgs.global,
      }));

    // Build Section 3 title and radar element
    let radarTitle = "Profil Cognitif — Dernière session";
    let radarElement: React.ReactNode = null;

    if (isCompare) {
      radarTitle = "Comparaison des Profils Cognitifs";
      const overlays: RadarOverlay[] = [
        { dimensions: radarA!, color: RAJA_RED, label: "Session A" },
        { dimensions: radarB!, color: COMPARE_BLUE, label: "Session B" },
      ];
      radarElement = (
        <>
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <RadarChart overlays={overlays} size={260} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              fontSize: 11,
              color: TEXT,
              marginTop: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  background: RAJA_RED,
                  borderRadius: 2,
                }}
              />
              <span>
                Session A — {format(new Date(sessionA!.date), "dd MMM yyyy", { locale: fr })} (SGS:{" "}
                {sessionA!.sgs.global})
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  background: COMPARE_BLUE,
                  borderRadius: 2,
                }}
              />
              <span>
                Session B — {format(new Date(sessionB!.date), "dd MMM yyyy", { locale: fr })} (SGS:{" "}
                {sessionB!.sgs.global})
              </span>
            </div>
          </div>
        </>
      );
    } else {
      const dims = selectedSession
        ? selectedSession.sgs.dimensions.map((d) => {
            const match = latestRadar.find((r) => r.key === d.key);
            return { ...d, label: match?.label ?? d.label };
          })
        : latestRadar;
      const dateLabel = selectedSession
        ? format(new Date(selectedSession.date), "dd MMMM yyyy", { locale: fr })
        : null;
      radarTitle = dateLabel
        ? `Profil Cognitif — Session du ${dateLabel}`
        : "Profil Cognitif — Dernière session";
      if (dims.length > 0) {
        radarElement = (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <RadarChart dimensions={dims} size={260} />
          </div>
        );
      }
    }

    // Section 4 — comparison dim values (lookup A/B)
    const dimValue = (s: SessionGroup | undefined, key: string) =>
      s?.sgs.dimensions.find((d) => d.key === key)?.score ?? 0;

    return (
      <div
        ref={ref}
        style={{
          width: 794,
          padding: 40,
          background: "#ffffff",
          color: TEXT,
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: RAJA_RED,
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
              fontFamily: "Inter, Arial, sans-serif",
            }}
          >
            R
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>
              Raja CogniLab — Rapport Cognitif
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              Académie Raja Club Athletic
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 18,
            paddingTop: 12,
            borderTop: `1px solid ${BORDER}`,
            fontSize: 12,
            color: TEXT,
          }}
        >
          <div>
            <strong>Joueur :</strong> {userName ?? "—"}
          </div>
          <div>
            <strong>Date :</strong> {exportDate}
          </div>
        </div>

        {/* SECTION 1 — SGS */}
        <div style={sectionTitleStyle}>Score Global Synthétique</div>
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1,
              color: scoreColor(sgsValue),
            }}
          >
            {sgsValue}
            <span style={{ fontSize: 24, color: MUTED, fontWeight: 600 }}>/100</span>
          </div>
          <div
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: "4px 14px",
              borderRadius: 999,
              background: scoreColor(sgsValue),
              color: "#ffffff",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {statusLabel(sgsValue)}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: MUTED }}>
            Basé sur {groups.length} session{groups.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* SECTION 2 — Évolution */}
        <div style={sectionTitleStyle}>Évolution du SGS</div>
        <div style={{ height: 180, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke={RAJA_RED}
                strokeWidth={2.5}
                isAnimationActive={false}
                dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  return (
                    <Dot
                      key={index}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={scoreColor(payload.score)}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* SECTION 3 — Profil cognitif */}
        {radarElement && (
          <>
            <div style={sectionTitleStyle}>{radarTitle}</div>
            {radarElement}
          </>
        )}

        {/* SECTION 4 — Dimensions table */}
        <div style={sectionTitleStyle}>Détail par Dimension</div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ background: RAJA_RED, color: "#ffffff" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700 }}>Dimension</th>
              <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700 }}>Meilleur</th>
              {isCompare ? (
                <>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "8px 12px",
                      fontWeight: 700,
                      background: RAJA_RED,
                    }}
                  >
                    Session A
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "8px 12px",
                      fontWeight: 700,
                      background: COMPARE_BLUE,
                    }}
                  >
                    Session B
                  </th>
                </>
              ) : (
                <>
                  <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700 }}>
                    Dernière
                  </th>
                  <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700 }}>
                    Tendance
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {dimStats.map((d, i) => {
              const arrow = d.trend === "up" ? "▲" : d.trend === "down" ? "▼" : "—";
              const arrowColor =
                d.trend === "up" ? "#16a34a" : d.trend === "down" ? "#dc2626" : MUTED;
              return (
                <tr
                  key={d.key}
                  style={{
                    background: i % 2 === 0 ? "#ffffff" : ROW_ALT,
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: TEXT }}>{d.label}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center", color: TEXT }}>
                    {d.best}/100
                  </td>
                  {isCompare ? (
                    <>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          color: TEXT,
                          fontWeight: 600,
                        }}
                      >
                        {dimValue(sessionA, d.key)}/100
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          color: TEXT,
                          fontWeight: 600,
                        }}
                      >
                        {dimValue(sessionB, d.key)}/100
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: TEXT }}>
                        {d.last}/100
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          color: arrowColor,
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {arrow}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* SECTION 5 — Last 5 sessions */}
        <div style={sectionTitleStyle}>5 Dernières Sessions</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: RAJA_RED, color: "#ffffff" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700 }}>Date</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700 }}>Tests</th>
              <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700 }}>SGS</th>
              <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700 }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {groups.slice(0, 5).map((g, i) => (
              <tr
                key={g.groupId}
                style={{
                  background: i % 2 === 0 ? "#ffffff" : ROW_ALT,
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <td style={{ padding: "8px 12px", color: TEXT }}>
                  {format(new Date(g.date), "dd MMM yyyy", { locale: fr })}
                </td>
                <td style={{ padding: "8px 12px", color: MUTED }}>
                  {g.testTypes.join(" • ") || "—"}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: scoreColor(g.sgs.global),
                  }}
                >
                  {g.sgs.global}/100
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center", color: TEXT }}>
                  {statusLabel(g.sgs.global)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* FOOTER */}
        <div
          style={{
            marginTop: 36,
            paddingTop: 12,
            borderTop: `1px solid ${BORDER}`,
            fontSize: 10,
            color: MUTED,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          <div>Généré par Raja CogniLab • {exportDate}</div>
          <div>Académie Raja Club Athletic — Usage interne</div>
        </div>
      </div>
    );
  }
);
