/**
 * SleepDiaryPage
 *
 * Displays a resident's sleep-health dashboard containing:
 *  - Four key metric cards (total sleep, efficiency, WASO, latency)
 *  - Sleep stages donut chart
 *  - Body movement lollipop bar chart
 *  - Sleep duration line chart
 *  - Wake episodes timeline
 *
 * Data is fetched from the API on mount (or whenever `residentId` changes)
 * and rendered with Recharts inside a responsive 1 / 2 / 3-column grid.
 */

import { useState, useEffect, useCallback } from "react";

import wakeIcon       from "../assets/wake_icon.svg";
import totalSleepIcon from "../assets/total_sleep_time.svg";
import efficiencyIcon from "../assets/sleep_efficiency.svg";
import latencyIcon    from "../assets/sleep_latency.svg";
import wasoIcon       from "../assets/wake_after_sleep.svg";

import useWindowSize  from "../hooks/useWindowSize";
import apiService     from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage   from "../components/ErrorMessage";

import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

/* ─────────────────────────────────────────────────────────────────────────
   Module-level constants
   ───────────────────────────────────────────────────────────────────────── */

/** Pure-white shorthand used throughout inline styles. */
const COLOR_WHITE = "#ffffff";

/**
 * Fallback resident ID used when no `residentId` prop is provided.
 * Replace with a proper default / redirect in production.
 */
const DEFAULT_RESIDENT_ID = "RES#res-20251112-0001";

/**
 * Fixed hourly slots that make up the overnight sleep window (10 PM – 6 AM).
 * Each slot is matched against wake-episode data returned by the backend.
 *
 * @type {{ hour: number, label: string }[]}
 */
const SLEEP_TIMELINE = [
  { hour: 22, label: "10PM" },
  { hour: 23, label: "11PM" },
  { hour: 0,  label: "12AM" },
  { hour: 1,  label: "1AM"  },
  { hour: 2,  label: "2AM"  },
  { hour: 3,  label: "3AM"  },
  { hour: 4,  label: "4AM"  },
  { hour: 5,  label: "5AM"  },
  { hour: 6,  label: "6AM"  },
];

/**
 * X-axis tick labels for the wake-episodes duration ruler (0 – 60 min).
 *
 * @type {string[]}
 */
const WAKE_DURATION_TICKS = ["0Min", "10Min", "20Min", "30Min", "40Min", "50Min", "60Min"];

/**
 * Legend entries for the body-movement colour gradient.
 * Each tuple is [hex background colour, display label].
 *
 * @type {[string, string][]}
 */
const MOVEMENT_LEGEND = [
  ["#ffffff", "No Movement"],
  ["#1578be", "Moderate Movement"],
  ["#0a2240", "High Movement"],
];

/** Legend entries for the sleep-duration quality indicator dots. */
const DURATION_LEGEND = ["Good Sleep", "Average Sleep", "Poor Sleep"];

/* ─────────────────────────────────────────────────────────────────────────
   Shared sub-components
   ───────────────────────────────────────────────────────────────────────── */

/**
 * GCard — Gradient card container used for every chart panel.
 *
 * Renders a dark navy gradient background with a subtle bottom glow
 * and a white 1 px border. All child content sits above the glow layer
 * via z-index.
 *
 * @param {{ children: React.ReactNode, style?: React.CSSProperties, p?: string }} props
 */
const GCard = ({ children, style = {}, p = "13px 15px" }) => (
  <div style={{
    position: "relative",
    borderRadius: 11,
    background: "linear-gradient(180deg, #0a1a30 0%, #0e2240 40%, #112a50 100%)",
    border: `1px solid ${COLOR_WHITE}`,
    overflow: "hidden",
    padding: p,
    ...style,
  }}>
    {/* Ambient bottom glow — purely decorative */}
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, height: "55%",
      background: "linear-gradient(to top, rgba(10,55,130,0.45) 0%, transparent 100%)",
      pointerEvents: "none",
      zIndex: 0,
    }} />

    {/* Content wrapper sits above the glow */}
    <div style={{
      position: "relative", zIndex: 1,
      height: "100%", display: "flex", flexDirection: "column",
    }}>
      {children}
    </div>
  </div>
);

/**
 * Pill — small outlined badge used to display wake-episode time and duration.
 *
 * @param {{ children: React.ReactNode }} props
 */
const Pill = ({ children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "1.5px solid rgba(255,255,255,0.55)",
    borderRadius: 999,
    padding: "2px 9px",
    fontSize: 9, color: COLOR_WHITE,
    whiteSpace: "nowrap", background: "transparent",
    letterSpacing: 0.2, minWidth: 48,
  }}>
    {children}
  </span>
);

/**
 * BackButton — fixed "Back to Resident Details" button shown in the top-left
 * corner while navigating from a resident profile to this sleep diary page.
 *
 * Extracted to avoid copy-pasting the same JSX across the loading, error,
 * and main render states.
 *
 * @param {{ onClick: () => void }} props
 */
const BackButton = ({ onClick }) => (
  <button
    onClick={onClick}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(4,37,88,1)";
      e.currentTarget.style.transform  = "translateX(-4px)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "rgba(4,37,88,0.95)";
      e.currentTarget.style.transform  = "translateX(0)";
    }}
    style={{
      position: "fixed", top: 80, left: 20, zIndex: 1001,
      background: "rgba(4,37,88,0.95)",
      border: `2px solid ${COLOR_WHITE}`,
      borderRadius: 12, padding: "12px 20px",
      color: COLOR_WHITE, fontSize: 16, fontWeight: 600,
      cursor: "pointer",
      display: "flex", alignItems: "center", gap: 8,
      transition: "all 0.2s",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}
  >
    {/* Left-pointing arrow icon */}
    <svg width="20" height="20" viewBox="0 0 24 24"
         fill="none" stroke={COLOR_WHITE} strokeWidth="2.5" strokeLinecap="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
    Back to Resident Details
  </button>
);

/* ─────────────────────────────────────────────────────────────────────────
   Custom Recharts shapes
   ───────────────────────────────────────────────────────────────────────── */

/**
 * LollipopBar — custom Recharts bar shape rendered as a thin vertical line
 * with a filled white circle on top (lollipop style).
 *
 * Used in the Body Movement bar chart to reduce visual weight compared to
 * a solid bar.
 *
 * @param {{ x: number, y: number, width: number, height: number }} props
 */
const LollipopBar = ({ x, y, width, height }) => {
  const cx = x + width / 2;
  return (
    <g>
      {/* Stem */}
      <line x1={cx} y1={y + height} x2={cx} y2={y + 6}
            stroke={COLOR_WHITE} strokeWidth={2} />
      {/* Head */}
      <circle cx={cx} cy={y + 4} r={5} fill={COLOR_WHITE} />
    </g>
  );
};

/**
 * SimpleDot — plain white circle used as the data-point dot on the Sleep
 * Duration line chart. Keeps the chart clean without quality-indicator icons.
 *
 * @param {{ cx: number, cy: number }} props  (injected by Recharts)
 */
const SimpleDot = ({ cx, cy }) => (
  <circle cx={cx} cy={cy} r={5}
          fill={COLOR_WHITE} stroke={COLOR_WHITE} strokeWidth={1} />
);

/* ─────────────────────────────────────────────────────────────────────────
   Page component
   ───────────────────────────────────────────────────────────────────────── */

/**
 * SleepDiaryPage — full-page sleep dashboard for a single resident.
 *
 * @param {{
 *   residentId?:       string,   // Overrides the default demo resident
 *   showBackButton?:   boolean,  // Show the fixed back-navigation button
 *   onBackToResident?: () => void
 * }} props
 */
export default function SleepDiaryPage({ residentId, showBackButton, onBackToResident }) {
  const [sleepData, setSleepData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const { isMobile, isTablet, isDesktop } = useWindowSize();

  // Resolve which resident to display — prefer the explicit prop
  const activeResidentId = residentId || DEFAULT_RESIDENT_ID;

  /**
   * Fetch sleep data for `activeResidentId` from the API.
   * Wrapped in `useCallback` so that `useEffect` can list it as a stable
   * dependency without triggering an infinite loop.
   */
  const loadSleepData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getSleepData(activeResidentId);
      setSleepData(data);
    } catch (err) {
      console.error("Failed to load sleep data for resident:", activeResidentId, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [activeResidentId]);

  // Re-fetch whenever the target resident changes
  useEffect(() => { loadSleepData(); }, [loadSleepData]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <main style={centerLayoutStyle}>
        {showBackButton && onBackToResident && <BackButton onClick={onBackToResident} />}
        <LoadingSpinner message="Loading sleep data..." />
      </main>
    );
  }

  /* ── Error / no-data state ── */
  if (error || !sleepData) {
    return (
      <main style={centerLayoutStyle}>
        {showBackButton && onBackToResident && <BackButton onClick={onBackToResident} />}
        <ErrorMessage error={error} onRetry={loadSleepData} residentId={activeResidentId} />
      </main>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────
     Data transformations — convert API shapes into Recharts-friendly arrays
     ───────────────────────────────────────────────────────────────────── */

  /** Sleep duration points: { day, hours, q } — one entry per tracked day. */
  const sleepDurationData = sleepData.sleepDurationOverTime.map(d => ({
    day: d.day, hours: d.hours, q: d.quality,
  }));

  /** Body-movement samples: { t (time label), h (movement value) }. */
  const movementData = sleepData.bodyMovement.map(d => ({
    t: d.time, h: d.value,
  }));

  /**
   * Wake-episode rows aligned to the fixed overnight timeline.
   * Slots with no recorded episode get `dur: 0` and `hasData: false`
   * so the chart still renders a faint placeholder line for that hour.
   */
  const wakeEpisodes = SLEEP_TIMELINE.map(slot => {
    const episode = sleepData.wakeEpisodes.find(e => e.hourLabel === slot.label);
    return {
      label:    slot.label,
      dur:      episode ? episode.duration  : 0,
      wakeTime: episode ? episode.wakeTime  : "",
      wakeDur:  episode ? episode.wakeDur   : "",
      hasData:  !!episode,
    };
  });

  /** Sleep-stage segments for the donut chart. */
  const stagesData = [
    { name: "REM Sleep",   value: sleepData.sleepStages.remSleep,   color: "#5bb8e8" },
    { name: "Light Sleep", value: sleepData.sleepStages.lightSleep, color: "#c5e4f3" },
    { name: "Deep Sleep",  value: sleepData.sleepStages.deepSleep,  color: "#1a6fb5" },
  ];

  // Derive human-readable totals shown below the donut
  const totalSleepHours   = Math.floor(sleepData.sleepStages.totalMinutes / 60);
  const totalSleepMinutes = sleepData.sleepStages.totalMinutes;

  /** Four KPI cards in the left column. */
  const metricCards = [
    { label: "Total Sleep Time",        val: String(sleepData.metrics.totalSleepTime.value),       unit: sleepData.metrics.totalSleepTime.unit,       pct: `${sleepData.metrics.totalSleepTime.change}%`,       icon: totalSleepIcon },
    { label: "Sleep Efficiency",        val: String(sleepData.metrics.sleepEfficiency.value),      unit: sleepData.metrics.sleepEfficiency.unit,      pct: `${sleepData.metrics.sleepEfficiency.change}%`,      icon: efficiencyIcon },
    { label: "Wake After Sleep\nOnset", val: String(sleepData.metrics.wakeAfterSleepOnset.value),  unit: sleepData.metrics.wakeAfterSleepOnset.unit,  pct: `${sleepData.metrics.wakeAfterSleepOnset.change}%`,  icon: wasoIcon },
    { label: "Sleep Latency",           val: String(sleepData.metrics.sleepLatency.value),         unit: sleepData.metrics.sleepLatency.unit,         pct: `${sleepData.metrics.sleepLatency.change}%`,         icon: latencyIcon },
  ];

  /* ─────────────────────────────────────────────────────────────────────
     Responsive sizing — derived from the current breakpoint
     ───────────────────────────────────────────────────────────────────── */

  const gap         = isMobile ? 8 : 10;
  const threeCol    = isDesktop;
  const donutInner  = isMobile ? 40 : isTablet ? 50 : 60;
  const donutOuter  = isMobile ? 58 : isTablet ? 68 : 82;
  const donutHeight = isMobile ? 140 : isTablet ? 170 : 200;
  const headerFont  = isMobile ? 14 : isTablet ? 16 : 18;
  const wakeRightW  = isMobile ? 60 : isTablet ? 80 : 110;

  /* ─────────────────────────────────────────────────────────────────────
     Render
     ───────────────────────────────────────────────────────────────────── */

  return (
    <main style={{
      flex: 1,
      padding: isMobile ? "10px 10px" : "12px 60px",
      // Extra top padding keeps content below the fixed navbar (and back button)
      paddingTop: isMobile ? 80 : (showBackButton ? 150 : 120),
      overflowY: "auto",
      display: "flex", flexDirection: "column",
      gap, minWidth: 0,
      position: "relative", zIndex: 1,
      marginTop: 0,
    }}>

      {/* Fixed back-navigation button (only when navigating from a resident profile) */}
      {showBackButton && onBackToResident && <BackButton onClick={onBackToResident} />}

      {/* ── Responsive main grid: 1 col (mobile) / 2 col (tablet) / 3 col (desktop) ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: threeCol
          ? "300px 1fr 1fr"
          : isTablet ? "1fr 1fr" : "1fr",
        gap, flex: 1, minHeight: 0,
      }}>

        {/* ══════════════════════════════════════════════════════════════
            LEFT COLUMN — Four KPI metric cards
            On tablet the column spans the full width to display 2 × 2.
            ══════════════════════════════════════════════════════════════ */}
        <div style={{
          borderRadius: 14,
          background: "#091428",
          border: `2px solid ${COLOR_WHITE}`,
          padding: isMobile ? 12 : isTablet ? 16 : 24,
          display: "flex",
          flexDirection: isMobile ? "row" : "column",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: isMobile ? 8 : isTablet ? 10 : 16,
          // Span both tablet columns so the 4 cards sit at the top across the full width
          gridColumn: isTablet && !threeCol ? "1 / -1" : "auto",
        }}>
          {metricCards.map(({ label, val, unit, pct, icon }) => (
            <div key={label} style={{
              flex: isMobile ? "1 1 calc(50% - 4px)" : 1,
              minWidth: isMobile ? 140 : "auto",
              background: "linear-gradient(180deg, #1b3352 0%, #1e3a5c 50%, #213f62 100%)",
              borderRadius: 10,
              padding: isMobile ? "6px 8px" : isTablet ? "8px 10px" : "10px 14px",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              {/* Row 1: metric label (left) + percentage change badge (right) */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", marginBottom: isMobile ? 2 : 4,
              }}>
                <span style={{
                  fontSize: isMobile ? 11 : 15, color: COLOR_WHITE,
                  fontWeight: 700, lineHeight: 1.25, whiteSpace: "pre-line",
                }}>
                  {label}
                </span>

                {/* Circular badge: change % + downward arrow */}
                <div style={{
                  width: isMobile ? 36 : isTablet ? 42 : 50,
                  height: isMobile ? 36 : isTablet ? 42 : 50,
                  borderRadius: "50%",
                  border: `2px solid ${COLOR_WHITE}`,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginLeft: 6,
                }}>
                  <span style={{
                    fontSize: isMobile ? 9 : 13, fontWeight: 700,
                    color: COLOR_WHITE, lineHeight: 1,
                  }}>
                    {pct}
                  </span>
                  {/* Down-right arrow — indicates direction of change */}
                  <svg width="12" height="12" viewBox="0 0 16 16"
                       fill="none" style={{ marginTop: 1 }}>
                    <path d="M4 4l8 8M12 5v7H5"
                          stroke="#ff4444" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Row 2: decorative icon (left) + numeric value + unit (right) */}
              <div style={{
                display: "flex", alignItems: "flex-end",
                gap: isMobile ? 12 : 16,
              }}>
                <img src={icon} alt={label} style={{
                  width: isMobile ? 36 : isTablet ? 50 : 60,
                  height: isMobile ? 36 : isTablet ? 50 : 60,
                  objectFit: "contain", flexShrink: 0,
                }} />
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{
                    fontSize: isMobile ? 28 : isTablet ? 40 : 52,
                    fontWeight: 700, color: COLOR_WHITE, lineHeight: 1,
                  }}>
                    {val}
                  </span>
                  <span style={{
                    fontSize: isMobile ? 11 : isTablet ? 14 : 18,
                    color: COLOR_WHITE, opacity: 0.85, fontWeight: 500,
                  }}>
                    {unit}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            MIDDLE COLUMN — Sleep Stages donut + Body Movement bar chart
            ══════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap, minHeight: 0 }}>

          {/* Sleep Stages Distribution — three-segment donut */}
          <GCard p="14px 14px" style={{
            flex: threeCol ? 1 : "unset",
            minHeight: threeCol ? 0 : "auto",
          }}>
            <p style={{ margin: "0 0 8px", fontSize: headerFont, color: COLOR_WHITE, fontWeight: 700 }}>
              Sleep Stages Distribution
            </p>

            {/* Deep Sleep label — Donut — REM Sleep label (horizontal row) */}
            <div style={{
              display: "flex", alignItems: "center",
              gap: 0, flex: 1, minHeight: 0,
            }}>
              {/* Deep Sleep label (left) */}
              <div style={{
                flexShrink: 0, display: "flex", flexDirection: "column",
                alignItems: "flex-end", gap: 4,
              }}>
                <span style={{ fontSize: 13, color: COLOR_WHITE, fontWeight: 600, fontStyle: "italic" }}>Deep Sleep</span>
                <span style={{ fontSize: 18, color: COLOR_WHITE, fontWeight: 700 }}>
                  {sleepData.sleepStages.deepSleep}%
                </span>
              </div>

              {/* Connector line (left) */}
              <div style={{ width: 20, height: 2, background: COLOR_WHITE, flexShrink: 0 }} />

              {/* Donut chart */}
              <div style={{ flex: 1, position: "relative" }}>
                <ResponsiveContainer width="100%" height={donutHeight}>
                  <PieChart>
                    <Pie
                      data={stagesData}
                      cx="50%" cy="50%"
                      innerRadius={donutInner} outerRadius={donutOuter}
                      startAngle={90} endAngle={-270}
                      dataKey="value" strokeWidth={0}
                    >
                      {stagesData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Soft glow underneath the donut — decorative only */}
                <div style={{
                  position: "absolute", bottom: 8, left: "50%",
                  transform: "translateX(-50%)",
                  width: "50%", height: 16,
                  pointerEvents: "none",
                  background: "radial-gradient(ellipse, rgba(21,120,190,0.55) 0%, transparent 70%)",
                  filter: "blur(5px)",
                }} />
              </div>

              {/* Connector line (right) */}
              <div style={{ width: 20, height: 2, background: COLOR_WHITE, flexShrink: 0 }} />

              {/* REM Sleep label (right) */}
              <div style={{
                flexShrink: 0, display: "flex", flexDirection: "column",
                alignItems: "flex-start", gap: 4,
              }}>
                <span style={{ fontSize: 13, color: COLOR_WHITE, fontWeight: 600, fontStyle: "italic" }}>REM Sleep</span>
                <span style={{ fontSize: 18, color: COLOR_WHITE, fontWeight: 700 }}>
                  {sleepData.sleepStages.remSleep}%
                </span>
              </div>
            </div>

            {/* Light Sleep label — sits below the donut, connected by a vertical line */}
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 2, marginTop: 0, flexShrink: 0,
            }}>
              <div style={{ width: 2, height: 16, background: COLOR_WHITE }} />
              <span style={{ fontSize: 16, color: COLOR_WHITE, fontWeight: 700 }}>
                {sleepData.sleepStages.lightSleep}%
              </span>
              <span style={{ fontSize: 13, color: COLOR_WHITE, fontWeight: 600, fontStyle: "italic" }}>
                Light Sleep
              </span>
            </div>

            <p style={{
              margin: "8px 0 0", textAlign: "center",
              fontSize: 14, color: COLOR_WHITE, opacity: 0.7,
              fontStyle: "italic", flexShrink: 0,
            }}>
              Total sleep time of {totalSleepHours} hours ({totalSleepMinutes} minutes)
            </p>
          </GCard>

          {/* Body Movement Analysis — lollipop bar chart */}
          <GCard p="14px 14px" style={{
            flex: threeCol ? 1 : "unset",
            minHeight: threeCol ? 0 : 260,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: 6, flexShrink: 0,
            }}>
              <p style={{ margin: 0, fontSize: headerFont, color: COLOR_WHITE, fontWeight: 700 }}>
                Body Movement Analysis
              </p>

              {/* Movement intensity legend */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                {MOVEMENT_LEGEND.map(([color, label]) => (
                  <span key={label} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: 10, color: COLOR_WHITE,
                  }}>
                    <span style={{
                      width: 10, height: 10, background: color,
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: 2, display: "inline-block",
                    }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 0 }}>
              {/* Vertical colour gradient bar — mirrors the legend visually */}
              <div style={{
                width: 10, borderRadius: 4, flexShrink: 0,
                background: "linear-gradient(to bottom, #0a2240 0%, #1578be 50%, #ffffff 100%)",
              }} />

              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={movementData}
                  barCategoryGap="30%"
                  margin={{ bottom: 0, top: 12, left: 0, right: 4 }}
                >
                  <XAxis
                    dataKey="t"
                    tick={{ fill: COLOR_WHITE, fontSize: isMobile ? 9 : 11, fontStyle: "italic" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Bar dataKey="h" shape={<LollipopBar />} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GCard>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT COLUMN — Sleep Duration line chart + Wake Episodes timeline
            ══════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap, minHeight: 0 }}>

          {/* Sleep Duration Over Time — line chart */}
          <GCard p="14px 14px" style={{
            flex: threeCol ? 1 : "unset",
            minHeight: threeCol ? 0 : 280,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: 4, flexShrink: 0,
            }}>
              <div>
                <p style={{
                  margin: 0, fontSize: headerFont,
                  color: COLOR_WHITE, fontWeight: 700, display: "inline",
                }}>
                  Sleep Duration Over Time
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: COLOR_WHITE, opacity: 0.8 }}>
                  Hrs
                </p>
              </div>

              {/* Quality legend — circles mirror the SimpleDot shape on the line */}
              <div style={{
                display: "flex", flexDirection: "column",
                gap: 3, alignItems: "flex-end",
              }}>
                {DURATION_LEGEND.map(label => (
                  <span key={label} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: isMobile ? 9 : 11, color: COLOR_WHITE, opacity: 0.85,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" />
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div style={{
              position: "relative", flex: 1, minHeight: 0,
              height: threeCol ? "100%" : 220,
            }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={sleepDurationData}
                  margin={{ top: 8, right: 12, bottom: 18, left: 0 }}
                >
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.15)"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: COLOR_WHITE, fontSize: 11, fontWeight: 600 }}
                    axisLine={{ stroke: COLOR_WHITE, strokeWidth: 1.5 }}
                    tickLine={false}
                    label={{
                      value: "Days", position: "insideBottomLeft",
                      dx: -4, dy: 14,
                      fill: COLOR_WHITE, fontSize: 11, fontStyle: "italic",
                    }}
                  />
                  <YAxis
                    domain={[0, 8]} ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8]}
                    tick={{ fill: COLOR_WHITE, fontSize: 11 }}
                    axisLine={{ stroke: COLOR_WHITE, strokeWidth: 1.5 }}
                    tickLine={false} width={22}
                  />
                  <Line
                    type="linear" dataKey="hours"
                    stroke={COLOR_WHITE} strokeWidth={2}
                    dot={<SimpleDot />}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GCard>

          {/* Wake Episodes — horizontal lollipop timeline (10 PM – 6 AM) */}
          <GCard p="14px 14px" style={{
            flex: threeCol ? 1 : "unset",
            minHeight: threeCol ? 0 : 320,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: 5, flexShrink: 0,
            }}>
              <p style={{ margin: 0, fontSize: headerFont, color: COLOR_WHITE, fontWeight: 700 }}>
                Wake Episodes
              </p>

              {/* Time / Duration table header + data rows */}
              <div style={{
                display: "flex", flexDirection: "column",
                gap: 4, alignItems: "flex-end",
              }}>
                <div style={{ display: "flex", gap: 8, paddingRight: 2 }}>
                  <span style={{ fontSize: 11, color: COLOR_WHITE, minWidth: 60, textAlign: "center" }}>
                    Time
                  </span>
                  <span style={{ fontSize: 11, color: COLOR_WHITE, minWidth: 48, textAlign: "center" }}>
                    Duration
                  </span>
                </div>

                {/* Only show rows for hours that actually had a recorded wake event */}
                {wakeEpisodes
                  .filter(e => e.hasData && e.wakeTime)
                  .map(({ wakeTime, wakeDur }, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Pill>{wakeTime}</Pill>
                      <Pill>{wakeDur}</Pill>
                    </div>
                  ))
                }
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {/* One row per hour slot */}
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                justifyContent: "space-evenly", minHeight: 0,
              }}>
                {wakeEpisodes.map(({ label, dur, hasData }, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* Hour label */}
                    <span style={{
                      width: 34, fontSize: 11, color: COLOR_WHITE,
                      flexShrink: 0, textAlign: "right",
                    }}>
                      {label}
                    </span>

                    <div style={{
                      flex: 1, height: 12,
                      position: "relative", display: "flex", alignItems: "center",
                    }}>
                      {hasData && dur > 0 ? (
                        <>
                          {/* Line width is proportional to duration (max 60 min = 100%) */}
                          <div style={{
                            width: `${(dur / 60) * 100}%`,
                            height: 2, background: COLOR_WHITE, minWidth: 16,
                          }} />
                          {/* Terminal circle at the end of the line */}
                          <div style={{
                            width: 10, height: 10, borderRadius: "50%",
                            background: COLOR_WHITE, flexShrink: 0, marginLeft: -1,
                          }} />
                          {/* Wake icon after the circle */}
                          <img src={wakeIcon} alt="Wake" style={{
                            width: isMobile ? 22 : 30, height: isMobile ? 22 : 30,
                            objectFit: "contain", marginLeft: 2,
                            // Invert the SVG so it renders in white regardless of source colour
                            filter: "brightness(0) invert(1)",
                            display: "block",
                          }} />
                        </>
                      ) : (
                        /* Faint placeholder line for hours with no wake event */
                        <div style={{
                          width: "100%", height: 1,
                          background: "rgba(255,255,255,0.07)",
                        }} />
                      )}
                    </div>

                    {/* Right spacer keeps the chart area away from the pill table */}
                    <div style={{ width: wakeRightW, flexShrink: 0 }} />
                  </div>
                ))}
              </div>

              {/* Duration ruler: 0 – 60 min tick labels */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                paddingLeft: 34, paddingRight: wakeRightW,
                marginTop: 4, flexShrink: 0,
              }}>
                {WAKE_DURATION_TICKS.map(tick => (
                  <span key={tick} style={{
                    fontSize: isMobile ? 8 : 10,
                    color: COLOR_WHITE, fontWeight: 600,
                  }}>
                    {tick}
                  </span>
                ))}
              </div>
            </div>
          </GCard>
        </div>

      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Shared style objects
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Full-viewport centred layout used for the loading and error states.
 * Keeps the page vertically centred below the fixed navbar (90 px offset).
 */
const centerLayoutStyle = {
  flex: 1,
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  paddingTop: 90, minHeight: "100vh",
};