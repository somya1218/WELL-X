import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  Map as MapIcon,
  AlertTriangle,
  Search as SearchIcon,
  History as HistoryIcon,
  Wifi,
  WifiOff,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Gauge,
} from "lucide-react";

// ---------- Design tokens (Black & White theme) ----------
const C = {
  bg: "#FFFFFF",
  panel: "#FFFFFF",
  panel2: "#F4F4F5",
  border: "#E2E2E5",
  borderSoft: "#EDEDEF",
  amber: "#9A3412",
  amberSoft: "#FBEAE0",
  teal: "#0F172A",
  tealSoft: "#EAEAEC",
  red: "#B91C1C",
  redSoft: "#FBE7E7",
  green: "#166534",
  greenSoft: "#E7F3EA",
  text: "#111113",
  muted: "#55565F",
  mutedDim: "#8A8B94",
  sidebarBg: "#0B0B0C",
  sidebarPanel: "#1B1B1D",
  sidebarBorder: "#2A2A2D",
  sidebarText: "#F4F4F5",
  sidebarMuted: "#8A8B94",
};

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

// ---------- Mock domain data ----------
const CURRENT_WELL = { name: "OIL-241 (Active)", x: 50, y: 50, latitude: 27.35, longitude: 95.15 };

const OFFSET_WELLS = [
  { id: "OIL-114", x: 32, y: 34, distanceKm: 2.3, formation: "Barail Sandstone", hazard: "Mud Loss @ 2510m", detail: "40 bbl/hr loss encountered; LCM pill pumped, ROP dropped 60%.", severity: "high", depthBand: [2505, 2515] },
  { id: "OIL-098", x: 66, y: 28, distanceKm: 4.1, formation: "Tipam Sandstone", hazard: "Stuck Pipe @ 2465m", detail: "6 hrs NPT freeing BHA; overpull of 40 klbs recorded.", severity: "medium", depthBand: [2461, 2470] },
  { id: "OIL-076", x: 74, y: 62, distanceKm: 6.8, formation: "Barail Sandstone", hazard: "Kick @ 2540m", detail: "Well-control event; flow-check confirmed influx, BOP shut-in.", severity: "high", depthBand: [2535, 2546] },
  { id: "OIL-152", x: 22, y: 68, distanceKm: 8.5, formation: "Girujan Clay", hazard: "No major incidents", detail: "Clean drilling record through this interval.", severity: "low", depthBand: [2400, 2440] },
  { id: "OIL-133", x: 52, y: 82, distanceKm: 9.6, formation: "Tipam Sandstone", hazard: "Overpressure @ 2495m", detail: "Formation influx signs; mud weight raised 12.2 -> 13.1 ppg.", severity: "medium", depthBand: [2491, 2500] },
];

const DANGER_ZONES = OFFSET_WELLS.filter((w) => w.severity !== "low").map((w) => ({
  ...w,
}));

const REPORT_DB = [
  { id: 1, well: "OIL-114", depthRange: "2508 - 2512m", field: "Event Type", value: "Mud Loss (40 bbl/hr)", confidence: 92 },
  { id: 2, well: "OIL-114", depthRange: "2508 - 2512m", field: "Mud Weight", value: "12.5 ppg", confidence: 88 },
  { id: 3, well: "OIL-098", depthRange: "2463 - 2467m", field: "Event Type", value: "Stuck Pipe (6 hrs NPT)", confidence: 95 },
  { id: 4, well: "OIL-098", depthRange: "2463 - 2467m", field: "Overpull", value: "40 klbs", confidence: 79 },
  { id: 5, well: "OIL-076", depthRange: "2538 - 2542m", field: "Event Type", value: "Kick / Well Control Event", confidence: 90 },
  { id: 6, well: "OIL-133", depthRange: "2493 - 2497m", field: "Event Type", value: "Overpressure (Formation Influx)", confidence: 84 },
  { id: 7, well: "OIL-133", depthRange: "2493 - 2497m", field: "Mud Weight Change", value: "12.2 -> 13.1 ppg", confidence: 90 },
];

const START_DEPTH = 2448;
const END_DEPTH = 2560;

function sevColor(sev) {
  if (sev === "high") return C.red;
  if (sev === "medium") return C.amber;
  return C.green;
}
function sevBg(sev) {
  if (sev === "high") return C.redSoft;
  if (sev === "medium") return C.amberSoft;
  return C.greenSoft;
}

// ---------- Small reusable bits ----------
function Badge({ children, color, bg }) {
  return (
    <span
      style={{
        color,
        background: bg,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        padding: "3px 9px",
        borderRadius: 5,
        fontWeight: 600,
        whiteSpace: "normal",
        wordBreak: "break-word",
        lineHeight: 1.4,
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const color = value >= 90 ? C.green : value >= 75 ? C.amber : C.red;
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: 60, height: 5, background: C.borderSoft, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color }} />
      </div>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color }}>{value}%</span>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full text-left"
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        background: active ? C.sidebarPanel : "transparent",
        color: active ? C.sidebarText : C.sidebarMuted,
        border: active ? `1px solid ${C.sidebarBorder}` : "1px solid transparent",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
    >
      <Icon size={16} color={active ? C.sidebarText : C.sidebarMuted} />
      {label}
    </button>
  );
}

// ---------- Live Monitor ----------
function LiveMonitor({ history, latest, connection }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Depth" value={latest.depth.toFixed(1)} unit="m" color={C.teal} />
        <StatCard label="ROP" value={latest.rop.toFixed(1)} unit="m/hr" color={C.amber} />
        <StatCard label="Torque" value={latest.torque.toFixed(0)} unit="kNm" color={C.text} />
        <StatCard label="Mud Flow" value={latest.mudFlow.toFixed(0)} unit="L/min" color={C.text} />
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, color: C.text }}>
            Depth vs. Rate of Penetration
          </span>
          <ConnectionPill connection={connection} />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={history}>
            <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" />
            <XAxis
              dataKey="depth"
              tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }}
              stroke={C.border}
              tickFormatter={(v) => v.toFixed(0)}
            />
            <YAxis tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke={C.border} />
            <Tooltip
              contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: C.muted }}
              itemStyle={{ color: C.teal }}
            />
            <Line type="monotone" dataKey="rop" stroke={C.teal} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, color: C.text }}>
          Torque Trend
        </span>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={history} style={{ marginTop: 8 }}>
            <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" />
            <XAxis dataKey="depth" tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke={C.border} tickFormatter={(v) => v.toFixed(0)} />
            <YAxis tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke={C.border} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.muted }} />
            <Line type="monotone" dataKey="torque" stroke={C.amber} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", minWidth: 0, overflow: "hidden" }}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: C.muted, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "clamp(18px, 4vw, 26px)",
          fontWeight: 600,
          color,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
        <span style={{ fontSize: 13, color: C.mutedDim, marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  );
}

function ConnectionPill({ connection }) {
  const map = {
    good: { icon: Wifi, color: C.green, bg: C.greenSoft, label: "Live · Good" },
    degraded: { icon: AlertCircle, color: C.amber, bg: C.amberSoft, label: "Degraded · last-known data" },
    offline: { icon: WifiOff, color: C.red, bg: C.redSoft, label: "Offline · last-known data" },
  };
  const cfg = map[connection];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-1.5" style={{ background: cfg.bg, padding: "4px 12px", borderRadius: 999, flexShrink: 0 }}>
      <Icon size={12} color={cfg.color} style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: cfg.color, whiteSpace: "nowrap" }}>{cfg.label}</span>
    </div>
  );
}

// ---------- Offset Map (custom SVG, no external tiles needed) ----------
function OffsetMap({ radius, setRadius, selectedWell, setSelectedWell }) {
  const [hoveredWell, setHoveredWell] = useState(null);
  const radiusKm = { "2": 2, "5": 5, "10": 10 }[radius];
  const visibleWells = OFFSET_WELLS.filter((w) => w.distanceKm <= radiusKm);
  const displayWell = hoveredWell || selectedWell;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, minWidth: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, color: C.text }}>
            Offset Wells Within Radius
          </span>
          <div className="flex gap-1.5">
            {["2", "5", "10"].map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                style={{
                  background: radius === r ? C.teal : "transparent",
                  color: radius === r ? "#FFFFFF" : C.muted,
                  border: `1px solid ${radius === r ? C.teal : C.border}`,
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11.5,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        <svg viewBox="0 0 100 100" style={{ width: "100%", height: 340, background: C.panel2, borderRadius: 8 }}>
          {[2, 5, 10].map((rKm) => (
            <circle
              key={rKm}
              cx={50}
              cy={50}
              r={rKm * 4}
              fill="none"
              stroke={C.borderSoft}
              strokeWidth={0.4}
              strokeDasharray={rKm <= radiusKm ? "0" : "1.5,1.5"}
            />
          ))}
          <circle cx={50} cy={50} r={2.6} fill={C.teal} />
          <circle cx={50} cy={50} r={4.5} fill="none" stroke={C.teal} strokeWidth={0.5} opacity={0.5} />
          <text x={50} y={45} textAnchor="middle" fontSize="3.2" fill={C.teal} fontFamily="IBM Plex Mono">
            {CURRENT_WELL.name}
          </text>

          {visibleWells.map((w) => (
            <g
              key={w.id}
              onClick={() => setSelectedWell(w)}
              onMouseEnter={() => setHoveredWell(w)}
              onMouseLeave={() => setHoveredWell(null)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={w.x}
                cy={w.y}
                r={selectedWell?.id === w.id || hoveredWell?.id === w.id ? 2.9 : 2}
                fill={sevColor(w.severity)}
                stroke={selectedWell?.id === w.id ? C.text : hoveredWell?.id === w.id ? sevColor(w.severity) : "none"}
                strokeWidth={0.6}
                style={{ transition: "r 0.12s ease" }}
              />
              {hoveredWell?.id === w.id && (
                <circle cx={w.x} cy={w.y} r={4.6} fill="none" stroke={sevColor(w.severity)} strokeWidth={0.4} opacity={0.5} />
              )}
              <text x={w.x} y={w.y - 3.5} textAnchor="middle" fontSize="2.8" fill={C.muted} fontFamily="IBM Plex Mono">
                {w.id}
              </text>
            </g>
          ))}
        </svg>
        <div className="flex gap-4" style={{ marginTop: 10 }}>
          <LegendDot color={C.red} label="High risk history" />
          <LegendDot color={C.amber} label="Medium risk history" />
          <LegendDot color={C.green} label="Clean record" />
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, minWidth: 0 }}>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, color: C.text }}>
          Well Detail
        </span>
        {!displayWell ? (
          <p style={{ color: C.mutedDim, fontSize: 12.5, marginTop: 10, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Hover or click a well pin on the map to see its history.
          </p>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: C.text, fontWeight: 600 }}>{displayWell.id}</span>
              <div className="flex items-center gap-2">
                {hoveredWell && hoveredWell.id !== selectedWell?.id && (
                  <Badge color={C.mutedDim} bg={C.panel2}>preview</Badge>
                )}
                <Badge color={sevColor(displayWell.severity)} bg={sevBg(displayWell.severity)}>{displayWell.severity}</Badge>
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 8, fontFamily: "'IBM Plex Sans', sans-serif", lineHeight: 1.6, wordBreak: "break-word" }}>
              Distance: {displayWell.distanceKm} km · Formation: {displayWell.formation}
            </p>
            <div style={{ marginTop: 12, padding: 12, background: C.panel2, borderRadius: 8 }}>
              <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, marginBottom: 4, wordBreak: "break-word" }}>{displayWell.hazard}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{displayWell.detail}</div>
            </div>
            {!selectedWell || selectedWell.id !== displayWell.id ? (
              <button
                onClick={() => setSelectedWell(displayWell)}
                style={{
                  marginTop: 12,
                  width: "100%",
                  background: "none",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 11.5,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: 600,
                  color: C.muted,
                  cursor: "pointer",
                }}
              >
                Pin this well
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: "inline-block" }} />
      <span style={{ fontSize: 11, color: C.muted, fontFamily: "'IBM Plex Sans', sans-serif" }}>{label}</span>
    </div>
  );
}

// ---------- Alerts + Why panel ----------
function AlertsPanel({ alerts, expandedId, setExpandedId, onFeedback, onDismiss, onTriggerTest, feedbackStats }) {
  const usefulPct = feedbackStats.total === 0 ? null : Math.round((feedbackStats.useful / feedbackStats.total) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 600, color: C.text }}>
          Active Hazard Alerts
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {usefulPct !== null && (
            <Badge color={C.teal} bg={C.tealSoft}>{usefulPct}% of alerts marked useful this session</Badge>
          )}
          <button
            onClick={onTriggerTest}
            style={{
              background: "none",
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 11.5,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: 600,
              color: C.muted,
              cursor: "pointer",
            }}
          >
            + Trigger test alert
          </button>
        </div>
      </div>

      {alerts.length === 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, textAlign: "center" }}>
          <span style={{ color: C.mutedDim, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            No active alerts — current depth is outside any known offset-well danger zone.
          </span>
        </div>
      )}

      {alerts.map((a) => (
        <div key={a.id} style={{ background: C.panel, border: `1px solid ${sevColor(a.severity)}55`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: 16 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3" style={{ minWidth: 0, flex: 1 }}>
                <AlertTriangle size={18} color={sevColor(a.severity)} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, fontWeight: 600, color: C.text, wordBreak: "break-word" }}>
                    {a.title}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: C.muted, marginTop: 3, wordBreak: "break-word" }}>
                    Based on <span style={{ color: C.teal, fontWeight: 600 }}>{a.basedOn}</span> · at similar depth
                  </div>
                </div>
              </div>
              <div style={{ flexShrink: 0 }} className="flex items-center gap-2">
                <ConfidenceBar value={a.confidence} />
                <button
                  onClick={() => onDismiss(a.id)}
                  title="Dismiss alert"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                >
                  <X size={14} color={C.mutedDim} />
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12, padding: "10px 12px", background: C.panel2, borderRadius: 8, fontSize: 12.5, color: C.text, fontFamily: "'IBM Plex Sans', sans-serif", lineHeight: 1.5, wordBreak: "break-word" }}>
              <strong style={{ color: C.amber }}>Recommended action: </strong>
              {a.action}
            </div>

            <div className="flex items-center justify-between" style={{ marginTop: 12 }}>
              <button
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="flex items-center gap-1"
                style={{ background: "none", border: "none", color: C.teal, fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif", cursor: "pointer", fontWeight: 600 }}
              >
                Why this alert? {expandedId === a.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <div className="flex items-center gap-2">
                <IconBtn icon={ThumbsUp} onClick={() => onFeedback(a.id, true)} active={a.feedback === "up"} activeColor={C.green} />
                <IconBtn icon={ThumbsDown} onClick={() => onFeedback(a.id, false)} active={a.feedback === "down"} activeColor={C.red} />
              </div>
            </div>
          </div>

          {expandedId === a.id && (
            <div style={{ borderTop: `1px solid ${C.border}`, padding: 16, background: C.panel2 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {a.explanation}
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={a.comparisonData}>
                  <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" />
                  <XAxis dataKey="depth" tick={{ fill: C.muted, fontSize: 10, fontFamily: "IBM Plex Mono" }} stroke={C.border} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10, fontFamily: "IBM Plex Mono" }} stroke={C.border} />
                  <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="current" name="Current well" stroke={C.teal} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="offset" name="Offset well" stroke={C.amber} strokeWidth={2} strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4" style={{ marginTop: 6 }}>
                <LegendDot color={C.teal} label="Current well torque" />
                <LegendDot color={C.amber} label={`${a.basedOn} torque`} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, active, activeColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? `${activeColor}22` : "transparent",
        border: `1px solid ${active ? activeColor : C.border}`,
        borderRadius: 6,
        padding: 5,
        cursor: "pointer",
        display: "flex",
      }}
    >
      <Icon size={13} color={active ? activeColor : C.mutedDim} />
    </button>
  );
}

// ---------- Report Search ----------
function ReportSearch({ query, setQuery, corrections, setCorrections, onLog, backendResults, searchLoading }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const sourceResults = backendResults.length > 0 ? backendResults : REPORT_DB;
  const results = sourceResults.filter((r) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      r.well.toLowerCase().includes(q) ||
      r.field.toLowerCase().includes(q) ||
      r.value.toLowerCase().includes(q) ||
      r.depthRange.toLowerCase().includes(q)
    );
  });

  if (sortField) {
    results.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const columns = [
    { label: "Well", field: "well" },
    { label: "Depth", field: "depthRange" },
    { label: "Field", field: "field" },
    { label: "Extracted Value", field: "value" },
    { label: "AI Confidence", field: "confidence" },
    { label: "", field: null },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
        <SearchIcon size={16} color={C.mutedDim} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search old well reports... e.g. 'stuck pipe' or 'OIL-114'"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: C.text,
            fontSize: 13,
            width: "100%",
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        />
        {searchLoading && <span style={{ color: C.mutedDim, fontSize: 11 }}>Searching...</span>}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {columns.map((col) => (
                <th
                  key={col.label || "actions"}
                  onClick={() => col.field && toggleSort(col.field)}
                  style={{
                    textAlign: "left",
                    padding: "10px 14px",
                    fontSize: 11,
                    color: sortField === col.field ? C.teal : C.mutedDim,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontWeight: 600,
                    cursor: col.field ? "pointer" : "default",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortField === col.field && (sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const corrected = corrections[r.id];
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                  <td style={cellStyle}>{r.well}</td>
                  <td style={{ ...cellStyle, fontFamily: "'IBM Plex Mono', monospace" }}>{r.depthRange}</td>
                  <td style={cellStyle}>{r.field}</td>
                  <td style={cellStyle}>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          style={{
                            background: C.panel2,
                            border: `1px solid ${C.teal}`,
                            borderRadius: 5,
                            color: C.text,
                            fontSize: 12,
                            padding: "3px 6px",
                            fontFamily: "'IBM Plex Sans', sans-serif",
                          }}
                        />
                        <button
                          onClick={() => {
                            setCorrections({ ...corrections, [r.id]: draft });
                            onLog(`Corrected "${r.field}" for ${r.well} (${r.depthRange})`);
                            setEditingId(null);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer" }}
                        >
                          <Check size={14} color={C.green} />
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                          <X size={14} color={C.mutedDim} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{corrected || r.value}</span>
                        {corrected && <Badge color={C.teal} bg={C.tealSoft}>corrected</Badge>}
                      </div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <ConfidenceBar value={r.confidence} />
                  </td>
                  <td style={cellStyle}>
                    {!isEditing && (
                      <button
                        onClick={() => {
                          setEditingId(r.id);
                          setDraft(corrected || r.value);
                        }}
                        className="flex items-center gap-1"
                        style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: C.muted, fontSize: 11 }}
                      >
                        <Pencil size={11} /> Correct
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {results.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 20, textAlign: "center", color: C.mutedDim, fontSize: 12.5 }}>
                  No matching extracted records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const cellStyle = { padding: "10px 14px", fontSize: 12.5, color: C.text, fontFamily: "'IBM Plex Sans', sans-serif" };

// ---------- Risk Timeline ----------
function RiskTimeline({ currentDepth }) {
  const bands = [];
  for (let d = START_DEPTH; d < END_DEPTH; d += 8) {
    const zone = DANGER_ZONES.find((z) => d + 8 > z.depthBand[0] && d < z.depthBand[1]);
    bands.push({ start: d, end: d + 8, zone });
  }
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, color: C.text }}>
        Depth-wise Risk Timeline
      </span>
      <p style={{ fontSize: 11.5, color: C.mutedDim, marginTop: 4, marginBottom: 14, fontFamily: "'IBM Plex Sans', sans-serif" }}>
        Built from offset-well incident history. Hover a band for detail.
      </p>
      <div className="flex" style={{ height: 46, borderRadius: 6, overflow: "hidden" }}>
        {bands.map((b, i) => {
          const color = b.zone ? sevColor(b.zone.severity) : C.borderSoft;
          const isCurrent = currentDepth >= b.start && currentDepth < b.end;
          return (
            <div
              key={i}
              title={b.zone ? `${b.start}-${b.end}m: ${b.zone.hazard} (${b.zone.id})` : `${b.start}-${b.end}m: no flagged history`}
              style={{
                flex: 1,
                background: color,
                opacity: b.zone ? 0.85 : 0.35,
                borderRight: isCurrent ? `2px solid ${C.text}` : "none",
                position: "relative",
              }}
            >
              {isCurrent && (
                <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: C.text, fontFamily: "IBM Plex Mono" }}>
                  ▼
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between" style={{ marginTop: 6 }}>
        <span style={{ fontSize: 10.5, color: C.mutedDim, fontFamily: "IBM Plex Mono" }}>{START_DEPTH}m</span>
        <span style={{ fontSize: 10.5, color: C.mutedDim, fontFamily: "IBM Plex Mono" }}>{END_DEPTH}m</span>
      </div>
      <div className="flex gap-4" style={{ marginTop: 12 }}>
        <LegendDot color={C.red} label="High risk zone" />
        <LegendDot color={C.amber} label="Medium risk zone" />
        <LegendDot color={C.borderSoft} label="No flagged history" />
      </div>
    </div>
  );
}

// ---------- Audit Trail ----------
function AuditTrail({ log, onClear }) {
  const [filter, setFilter] = useState("all");
  const visibleLog = filter === "all" ? log : log.filter((e) => e.tone === filter);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, color: C.text }}>
          Audit Trail
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5">
            {[
              { key: "all", label: "All" },
              { key: "warn", label: "Warnings" },
              { key: "neutral", label: "Routine" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  background: filter === f.key ? C.tealSoft : "transparent",
                  color: filter === f.key ? C.teal : C.mutedDim,
                  border: `1px solid ${filter === f.key ? C.teal : C.border}`,
                  borderRadius: 6,
                  padding: "3px 9px",
                  fontSize: 11,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClear}
            disabled={log.length === 0}
            style={{
              background: "none",
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "3px 9px",
              fontSize: 11,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: 600,
              color: log.length === 0 ? C.borderSoft : C.mutedDim,
              cursor: log.length === 0 ? "default" : "pointer",
            }}
          >
            Clear log
          </button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
        <thead>
          <tr>
            {["Time", "Event", "Action"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 18px", fontSize: 11, color: C.mutedDim, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleLog.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: 20, textAlign: "center", color: C.mutedDim, fontSize: 12.5 }}>
                {log.length === 0 ? "No actions logged yet this session." : "No entries match this filter."}
              </td>
            </tr>
          )}
          {visibleLog.map((entry, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
              <td style={{ ...cellStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.mutedDim }}>{entry.time}</td>
              <td style={cellStyle}>{entry.text}</td>
              <td style={cellStyle}>
                <Badge color={entry.tone === "warn" ? C.amber : C.teal} bg={entry.tone === "warn" ? C.amberSoft : C.tealSoft}>
                  {entry.action}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ---------- Root App ----------
export default function App() {
  const [tab, setTab] = useState("live");
  const [connection, setConnection] = useState("good");
  const [radius, setRadius] = useState("5");
  const [selectedWell, setSelectedWell] = useState(null);
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [query, setQuery] = useState("");
  const [corrections, setCorrections] = useState({});
  const [auditLog, setAuditLog] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState({ useful: 0, total: 0 });
  const [paused, setPaused] = useState(false);
  const [backendResults, setBackendResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [history, setHistory] = useState(() => {
    const arr = [];
    let d = START_DEPTH;
    for (let i = 0; i < 25; i++) {
      arr.push(genPoint(d));
      d += 2;
    }
    return arr;
  });

  const depthRef = useRef(history[history.length - 1].depth);
  const firedZones = useRef(new Set());
  const backendRequestInFlight = useRef(false);
  const lastBackendCheck = useRef(0);

  const logEvent = useCallback((text, tone = "neutral", action = "Logged") => {
    setAuditLog((prev) => [{ time: new Date().toLocaleTimeString(), text, tone, action }, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setBackendResults([]);
      setSearchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({
          lat: String(CURRENT_WELL.latitude),
          lon: String(CURRENT_WELL.longitude),
          depth_m: String(depthRef.current),
          query: query.trim(),
          top_k: "10",
        });
        const response = await fetch(`${API_BASE}/search?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Search failed: ${response.status}`);
        const data = await response.json();
        setBackendResults((data.results || []).map((result, index) => ({
          id: `api-${result.well_name}-${index}`,
          well: result.well_name,
          depthRange: result.incident_depth_m ? `${result.incident_depth_m}m` : "Unknown depth",
          field: result.incident_type || result.formation_type || "Incident",
          value: `${result.severity || "unknown"} severity · ${result.distance_km} km away`,
          confidence: Math.max(0, Math.min(100, Math.round((result.scores?.combined || 0) * 100))),
        })));
      } catch (error) {
        if (error.name !== "AbortError") setBackendResults([]);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      depthRef.current = depthRef.current + 2 > END_DEPTH ? START_DEPTH : depthRef.current + 2;
      const point = genPoint(depthRef.current);

      setHistory((prev) => [...prev.slice(-39), point]);

      if (!backendRequestInFlight.current && Date.now() - lastBackendCheck.current >= 6000) {
        backendRequestInFlight.current = true;
        lastBackendCheck.current = Date.now();
        fetch(`${API_BASE}/check_risk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: CURRENT_WELL.latitude,
            lon: CURRENT_WELL.longitude,
            current_depth_m: depthRef.current,
            planned_formation: "Gas-Bearing Sand",
            top_k: 5,
          }),
        })
          .then((response) => {
            if (!response.ok) throw new Error(`Risk check failed: ${response.status}`);
            return response.json();
          })
          .then((data) => {
            setConnection("good");
            const apiAlerts = (data.alerts || []).map((result, index) => {
              const severity = result.severity === "high" || result.severity === "medium" ? result.severity : "low";
              const confidence = Math.max(0, Math.min(100, Math.round((result.scores?.combined || 0) * 100)));
              return {
                id: `api-${result.well_name}-${index}`,
                api: true,
                severity,
                title: `Approaching ${result.incident_type || "known hazard"} zone`,
                basedOn: result.well_name,
                confidence,
                action: severity === "high"
                  ? "Reduce ROP and review the offset incident response before entering this interval."
                  : "Monitor drilling parameters closely and review the offset incident before proceeding.",
                explanation: `${result.well_name} is ${result.distance_km} km away and has a similar incident at ${result.incident_depth_m || "an unknown"} m. ${result.narrative}`,
                comparisonData: Array.from({ length: 8 }, (_, pointIndex) => ({
                  depth: (result.incident_depth_m || depthRef.current) - 10 + pointIndex * 3,
                  current: point.torque,
                  offset: point.torque * (severity === "high" ? 1.35 : 1.15),
                })),
                feedback: null,
              };
            });
            setAlerts((previous) => [...apiAlerts, ...previous.filter((alert) => !alert.api)]);
          })
          .catch(() => setConnection("degraded"))
          .finally(() => {
            backendRequestInFlight.current = false;
          });
      }

      const zone = DANGER_ZONES.find((z) => depthRef.current >= z.depthBand[0] && depthRef.current <= z.depthBand[1]);
      if (zone && !firedZones.current.has(zone.id)) {
        firedZones.current.add(zone.id);
        const alertId = `${zone.id}-${Date.now()}`;
        const comparisonData = Array.from({ length: 8 }, (_, i) => ({
          depth: zone.depthBand[0] + i * 1.5,
          current: 18 + Math.random() * 4,
          offset: zone.severity === "high" ? 26 + Math.random() * 6 : 21 + Math.random() * 4,
        }));
        setAlerts((prev) => [
          {
            id: alertId,
            severity: zone.severity,
            title: `Approaching ${zone.hazard.split(" @ ")[0]} zone`,
            basedOn: zone.id,
            confidence: zone.severity === "high" ? 87 + Math.floor(Math.random() * 8) : 70 + Math.floor(Math.random() * 10),
            action:
              zone.severity === "high"
                ? "Reduce ROP, prepare LCM pill on standby, brief crew on offset well incident before entering zone."
                : "Monitor torque/overpull closely, review offset well mitigation notes before proceeding.",
            explanation: `${zone.id} (${zone.distanceKm} km away, ${zone.formation}) recorded: ${zone.detail}`,
            comparisonData,
            feedback: null,
          },
          ...prev,
        ]);
        logEvent(`Alert fired: ${zone.hazard} (based on ${zone.id})`, zone.severity === "high" ? "warn" : "neutral", "Alert shown");
      }
      if (!zone) {
        const stillNear = DANGER_ZONES.some((z) => Math.abs(depthRef.current - z.depthBand[0]) < 3);
        if (!stillNear && depthRef.current < START_DEPTH + 2) {
          firedZones.current = new Set();
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [logEvent, paused]);

  function triggerTestAlert() {
    const candidates = DANGER_ZONES.filter((z) => !firedZones.current.has(`test-${z.id}`));
    const zone = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : DANGER_ZONES[Math.floor(Math.random() * DANGER_ZONES.length)];
    firedZones.current.add(`test-${zone.id}`);
    const alertId = `${zone.id}-${Date.now()}`;
    const comparisonData = Array.from({ length: 8 }, (_, i) => ({
      depth: zone.depthBand[0] + i * 1.5,
      current: 18 + Math.random() * 4,
      offset: zone.severity === "high" ? 26 + Math.random() * 6 : 21 + Math.random() * 4,
    }));
    setAlerts((prev) => [
      {
        id: alertId,
        severity: zone.severity,
        title: `Approaching ${zone.hazard.split(" @ ")[0]} zone`,
        basedOn: zone.id,
        confidence: zone.severity === "high" ? 87 + Math.floor(Math.random() * 8) : 70 + Math.floor(Math.random() * 10),
        action:
          zone.severity === "high"
            ? "Reduce ROP, prepare LCM pill on standby, brief crew on offset well incident before entering zone."
            : "Monitor torque/overpull closely, review offset well mitigation notes before proceeding.",
        explanation: `${zone.id} (${zone.distanceKm} km away, ${zone.formation}) recorded: ${zone.detail}`,
        comparisonData,
        feedback: null,
      },
      ...prev,
    ]);
    logEvent(`Test alert triggered: ${zone.hazard} (based on ${zone.id})`, zone.severity === "high" ? "warn" : "neutral", "Alert shown");
  }

  function dismissAlert(id) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    logEvent("Alert dismissed by engineer", "neutral", "Dismissed");
  }

  function genPoint(depth) {
    const nearZone = DANGER_ZONES.find((z) => depth >= z.depthBand[0] - 4 && depth <= z.depthBand[1] + 2);
    const stress = nearZone ? (nearZone.severity === "high" ? 1.6 : 1.25) : 1;
    return {
      depth,
      rop: Math.max(4, 14 / stress + (Math.random() - 0.5) * 3),
      torque: 16 * stress + (Math.random() - 0.5) * 3,
      mudFlow: 1200 + (Math.random() - 0.5) * 60,
      wob: 22 + (Math.random() - 0.5) * 4,
    };
  }

  function handleFeedback(id, useful) {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, feedback: useful ? "up" : "down" } : a)));
    setFeedbackStats((prev) => ({ useful: prev.useful + (useful ? 1 : 0), total: prev.total + 1 }));
    logEvent(`Alert marked ${useful ? "useful" : "not useful"} by engineer`, "neutral", useful ? "Accepted" : "Dismissed");
  }

  const latest = history[history.length - 1];

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        color: C.text,
        fontFamily: "'IBM Plex Sans', sans-serif",
        display: "flex",
      }}
    >
      <style>{FONT_IMPORT}</style>

      <div style={{ width: 220, background: C.sidebarBg, borderRight: `1px solid ${C.sidebarBorder}`, padding: 18, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <div style={{ marginBottom: 18, paddingLeft: 4 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, color: C.sidebarText, letterSpacing: 0.3 }}>eRTMAC</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.sidebarMuted }}>NWIS Console</div>
        </div>
        <NavItem icon={Activity} label="Live Monitor" active={tab === "live"} onClick={() => setTab("live")} />
        <NavItem icon={MapIcon} label="Offset Map" active={tab === "map"} onClick={() => setTab("map")} />
        <NavItem icon={AlertTriangle} label="Hazard Alerts" active={tab === "alerts"} onClick={() => setTab("alerts")} />
        <NavItem icon={SearchIcon} label="Report Search" active={tab === "search"} onClick={() => setTab("search")} />
        <NavItem icon={HistoryIcon} label="Audit Trail" active={tab === "history"} onClick={() => setTab("history")} />

        <div style={{ marginTop: "auto", paddingTop: 18, borderTop: `1px solid ${C.sidebarBorder}` }}>
          <div style={{ fontSize: 10.5, color: C.sidebarMuted, marginBottom: 8, fontFamily: "'IBM Plex Sans', sans-serif" }}>Simulate connection</div>
          <div className="flex gap-1.5">
            {["good", "degraded", "offline"].map((c) => (
              <button
                key={c}
                onClick={() => setConnection(c)}
                style={{
                  flex: 1,
                  fontSize: 10,
                  padding: "5px 2px",
                  borderRadius: 5,
                  border: `1px solid ${connection === c ? C.sidebarText : C.sidebarBorder}`,
                  background: connection === c ? C.sidebarPanel : "transparent",
                  color: connection === c ? C.sidebarText : C.sidebarMuted,
                  cursor: "pointer",
                  fontFamily: "'IBM Plex Mono', monospace",
                  textTransform: "capitalize",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          className="flex items-center justify-between flex-wrap gap-3"
          style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, rowGap: 8 }}
        >
          <div className="flex items-center gap-3 flex-wrap" style={{ minWidth: 0 }}>
            <Gauge size={18} color={C.amber} style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{CURRENT_WELL.name}</span>
            <Badge color={C.muted} bg={C.panel2}>Duliajan Field, Assam</Badge>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.mutedDim, whiteSpace: "nowrap" }}>
              Depth: <span style={{ color: C.teal, fontWeight: 600 }}>{latest.depth.toFixed(1)}m</span>
            </span>
            <button
              onClick={() => setPaused((p) => !p)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: paused ? C.amberSoft : C.panel2,
                color: paused ? C.amber : C.muted,
                border: `1px solid ${paused ? C.amber : C.border}`,
                borderRadius: 999,
                padding: "4px 12px",
                fontSize: 11.5,
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {paused ? "▶ Resume feed" : "⏸ Pause feed"}
            </button>
            <ConnectionPill connection={connection} />
          </div>
        </div>

        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          {tab === "live" && <LiveMonitor history={history} latest={latest} connection={connection} />}
          {tab === "map" && (
            <OffsetMap radius={radius} setRadius={setRadius} selectedWell={selectedWell} setSelectedWell={setSelectedWell} />
          )}
          {tab === "alerts" && (
            <div className="flex flex-col gap-6">
              <AlertsPanel
                alerts={alerts}
                expandedId={expandedAlertId}
                setExpandedId={setExpandedAlertId}
                onFeedback={handleFeedback}
                onDismiss={dismissAlert}
                onTriggerTest={triggerTestAlert}
                feedbackStats={feedbackStats}
              />
              <RiskTimeline currentDepth={latest.depth} />
            </div>
          )}
          {tab === "search" && (
            <ReportSearch query={query} setQuery={setQuery} corrections={corrections} setCorrections={setCorrections} onLog={(t) => logEvent(t, "neutral", "Corrected")} backendResults={backendResults} searchLoading={searchLoading} />
          )}
          {tab === "history" && <AuditTrail log={auditLog} onClear={() => setAuditLog([])} />}
        </div>
      </div>
    </div>
  );
}