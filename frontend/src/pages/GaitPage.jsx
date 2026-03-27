/**
 * Gait Analysis Page Component
 * 
 * Displays comprehensive gait and mobility analytics for a resident including:
 * - Key gait metrics (step frequency, stride length, balance score, fall risk)
 * - Step frequency trends over time
 * - Stride length distribution analysis
 * - Arm swing symmetry tracking
 * - Body tilt analysis with gauge visualization
 * - Clinical insights and recommendations
 * 
 * @component
 * @example
 * // Used standalone
 * <GaitPage />
 * 
 * // Used with resident details integration
 * <GaitPage 
 *   residentId="RES#res-20251112-0001"
 *   showBackButton={true}
 *   onBackToResident={handleBack}
 * />
 */

// React core imports
import { useState, useEffect } from "react";

// Custom hooks and services
import useWindowSize  from "../hooks/useWindowSize";
import apiService     from "../services/api";

// Reusable components
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage   from "../components/ErrorMessage";

// Asset imports - icons for gait metrics
import stepFreqIcon   from "../assets/step_frequency.svg";
import strideLenIcon  from "../assets/stride_length.svg";
import balanceIcon    from "../assets/balance_score.svg";
import fallRiskIcon   from "../assets/fall_risk_level.svg";
import armSwingIcon   from "../assets/arm_swing_symmetry.svg";
import bodyTiltIcon   from "../assets/body_tilt_analysis.svg";

// Recharts library - for data visualization
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, ComposedChart,
} from "recharts";

/* ═══════════════════════════════════════════════════════════════════════════
 * CONSTANTS & CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Default resident ID used when no resident is specified (demo/development) */
const RESIDENT_ID = "RES#res-20251112-0001";

/** White color constant used throughout the component */
const W = "#ffffff";

/* ═══════════════════════════════════════════════════════════════════════════
 * CUSTOM COMPONENTS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GCard - Gradient Card Component
 * 
 * A styled card component with a dark blue gradient background and subtle
 * lighting effect at the bottom. Used for all chart containers on the page.
 * 
 * Features:
 * - Dark blue gradient background for depth
 * - White border for definition
 * - Bottom glow effect for visual interest
 * - Configurable padding and additional styles
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Content to render inside the card
 * @param {Object} props.style - Additional CSS styles to apply
 * @param {string} props.p - Padding value (default: "13px 15px")
 * @returns {JSX.Element} Styled card container
 */
const GCard = ({ children, style = {}, p = "13px 15px" }) => (
  <div style={{
    position:"relative",
    borderRadius:11,
    background:"linear-gradient(180deg, #0a1a30 0%, #0e2240 40%, #112a50 100%)",
    border:"1px solid #ffffff",
    overflow:"hidden",
    padding:p,
    ...style,
  }}>
    {/* Bottom glow effect - creates depth and visual interest */}
    <div style={{
      position:"absolute",
      bottom:0,
      left:0,
      right:0,
      height:"55%",
      background:"linear-gradient(to top, rgba(10,55,130,0.45) 0%, transparent 100%)",
      pointerEvents:"none",
      zIndex:0,
    }}/>
    {/* Content container with higher z-index */}
    <div style={{
      position:"relative",
      zIndex:1,
      height:"100%",
      display:"flex",
      flexDirection:"column"
    }}>
      {children}
    </div>
  </div>
);

/**
 * GaugeChart - Semi-circular gauge visualization for body tilt
 * 
 * Renders a half-circle gauge with four colored segments (blue gradient)
 * and a needle indicator pointing to the current value. Used to visualize
 * body tilt analysis with color-coded severity zones.
 * 
 * Color zones (left to right):
 * - Dark blue (#1a6fb5): Normal tilt
 * - Medium blue (#3ea8d5): Slight imbalance  
 * - Light blue (#8ecae6): Moderate concern
 * - Lightest blue (#c5e4f3): Significant tilt
 * 
 * @param {Object} props - Component props
 * @param {number} props.value - Current value (0-100) determining needle position
 * @param {number} props.size - Width of the gauge in pixels (default: 220)
 * @returns {JSX.Element} SVG gauge chart
 */
const GaugeChart = ({ value = 50, size = 220 }) => {
  // Calculate gauge dimensions
  const w = size;
  const h = size * 0.6; // Height is 60% of width for semi-circle
  
  // Center point and radius calculations
  const cx = w / 2;           // Center X coordinate
  const cy = h - 6;           // Center Y coordinate (slightly above bottom)
  const r = w * 0.42;         // Outer radius
  const ri = r - (w * 0.1);   // Inner radius (creates donut effect)
  
  // Needle angle calculation
  const startAngle = Math.PI;  // Start at left (180 degrees)
  const needleAngle = startAngle - ((value / 100) * Math.PI); // Map value to angle
  
  // Needle tip coordinates
  const nx = cx + (r - 20) * Math.cos(needleAngle);
  const ny = cy - (r - 20) * Math.sin(needleAngle);

  /**
   * Helper function to create an arc segment
   * 
   * @param {number} s - Start angle in radians
   * @param {number} e - End angle in radians
   * @param {number} rin - Inner radius
   * @param {number} ro - Outer radius
   * @param {string} color - Fill color for the arc
   * @returns {JSX.Element} SVG path element
   */
  const arc = (s, e, rin, ro, color) => {
    // Calculate outer arc endpoints
    const x1o = cx + ro * Math.cos(s), y1o = cy - ro * Math.sin(s);
    const x2o = cx + ro * Math.cos(e), y2o = cy - ro * Math.sin(e);
    
    // Calculate inner arc endpoints
    const x2i = cx + rin * Math.cos(e), y2i = cy - rin * Math.sin(e);
    const x1i = cx + rin * Math.cos(s), y1i = cy - rin * Math.sin(s);
    
    // Determine if arc is large (> 180 degrees)
    const large = (s - e) > Math.PI ? 1 : 0;
    
    // Create donut segment path
    return <path d={`M${x1o},${y1o} A${ro},${ro} 0 ${large} 1 ${x2o},${y2o} L${x2i},${y2i} A${rin},${rin} 0 ${large} 0 ${x1i},${y1i} Z`} fill={color}/>;
  };

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {/* Four colored arc segments creating the gauge background */}
      {arc(Math.PI, Math.PI * 0.75, ri, r, "#1a6fb5")}        {/* Normal tilt */}
      {arc(Math.PI * 0.75, Math.PI * 0.5, ri, r, "#3ea8d5")}  {/* Slight imbalance */}
      {arc(Math.PI * 0.5, Math.PI * 0.25, ri, r, "#8ecae6")}  {/* Moderate */}
      {arc(Math.PI * 0.25, 0, ri, r, "#c5e4f3")}             {/* Significant tilt */}
      
      {/* Needle indicator */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={W} strokeWidth="3" strokeLinecap="round" />
      
      {/* Center pivot point */}
      <circle cx={cx} cy={cy} r="5" fill={W} />
    </svg>
  );
};

/**
 * StepLollipop - Custom bar chart component for step frequency visualization
 * 
 * Renders a vertical line (stick) with a circle on top (lollipop head) to represent
 * daily step counts. Color changes based on whether the step count meets the
 * recommended threshold of 3000 steps.
 * 
 * Color coding:
 * - White (#ffffff): Above 3000 steps (goal met)
 * - Blue (#5b9bd5): At or below 3000 steps (below goal)
 * 
 * @param {Object} props - Component props from Recharts
 * @param {number} props.x - X coordinate of the bar
 * @param {number} props.y - Y coordinate of the bar
 * @param {number} props.width - Width of the bar area
 * @param {number} props.height - Height of the bar
 * @param {Object} props.payload - Data payload containing step count
 * @returns {JSX.Element} SVG group containing line and circle
 */
const StepLollipop = ({ x, y, width, height, payload }) => {
  // Calculate center x-position for the lollipop
  const cx = x + width / 2;
  
  // Determine color based on step count threshold (3000 steps)
  const color = payload && payload.steps > 3000 ? "#ffffff" : "#5b9bd5";
  
  return (
    <g>
      {/* Vertical line (stick) from bottom to near top */}
      <line x1={cx} y1={y + height} x2={cx} y2={y + 5} stroke={color} strokeWidth={1.5}/>
      {/* Circle at top (lollipop head) */}
      <circle cx={cx} cy={y + 3} r={3.5} fill={color}/>
    </g>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GaitPage - Main component for gait analysis dashboard
 * 
 * Displays comprehensive gait and mobility metrics including step frequency,
 * stride length, balance scores, arm swing symmetry, and body tilt analysis.
 * Provides clinical insights and fall risk assessment.
 * 
 * @param {Object} props - Component props
 * @param {string} [props.residentId] - Resident ID to fetch gait data for
 * @param {boolean} [props.showBackButton] - Whether to show back button
 * @param {Function} [props.onBackToResident] - Callback when back button clicked
 * @returns {JSX.Element} Complete gait analysis dashboard
 */
export default function GaitPage({ residentId, showBackButton, onBackToResident }) {
  /* ───────────────────────────────────────────────────────────────────────────
   * STATE MANAGEMENT
   * ─────────────────────────────────────────────────────────────────────────── */
  
  /** Gait data from API */
  const [gaitData, setGaitData] = useState(null);
  
  /** Loading state for API calls */
  const [loading, setLoading] = useState(true);
  
  /** Error state for failed API calls */
  const [error, setError] = useState(null);
  
  /** Responsive layout breakpoints */
  const { isMobile, isTablet, isDesktop } = useWindowSize();

  /** Use passed residentId or fall back to default */
  const activeResidentId = residentId || RESIDENT_ID;

    /* ───────────────────────────────────────────────────────────────────────────
   * DATA FETCHING
   * ─────────────────────────────────────────────────────────────────────────── */
  
  /**
   * Load gait data from API
   * 
   * Fetches comprehensive gait analytics for the active resident including
   * metrics, step frequency trends, stride distribution, arm swing data,
   * and body tilt measurements.
   */
  const loadGaitData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch gait data from API service
      const data = await apiService.getGaitData(activeResidentId);
      
      setGaitData(data);
      
    } catch (err) {
      // Log error details for debugging
      console.error('Failed to load gait data:', err);
      console.error('Resident ID that failed:', activeResidentId);
      setError(err);
      
    } finally {
      // Always stop loading spinner
      setLoading(false);
    }
  };

  /**
   * Effect: Load gait data when resident changes
   * Refetches data whenever the activeResidentId changes
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadGaitData(); }, [activeResidentId]);

  /* ───────────────────────────────────────────────────────────────────────────
   * LOADING STATE
   * ─────────────────────────────────────────────────────────────────────────── */
  
  if (loading) {
    return (
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 120, minHeight: "100vh" }}>
        {showBackButton && onBackToResident && (
          <button
            onClick={onBackToResident}
            style={{
              position: "fixed", top: 80, left: 20, zIndex: 1001,
              background: "rgba(4,37,88,0.95)", border: "2px solid #FFFFFF",
              borderRadius: 12, padding: "12px 20px", color: W,
              fontSize: 16, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Resident Details
          </button>
        )}
        <LoadingSpinner message="Loading gait data..." />
      </main>
    );
  }

  /* ───────────────────────────────────────────────────────────────────────────
   * ERROR STATE
   * ─────────────────────────────────────────────────────────────────────────── */
  
  if (error || !gaitData) {
    return (
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 120, minHeight: "100vh" }}>
        {showBackButton && onBackToResident && (
          <button
            onClick={onBackToResident}
            style={{
              position: "fixed", top: 80, left: 20, zIndex: 1001,
              background: "rgba(4,37,88,0.95)", border: "2px solid #FFFFFF",
              borderRadius: 12, padding: "12px 20px", color: W,
              fontSize: 16, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Resident Details
          </button>
        )}
        <ErrorMessage error={error} onRetry={loadGaitData} residentId={activeResidentId} />
      </main>
    );
  }

    /* ───────────────────────────────────────────────────────────────────────────
   * DATA TRANSFORMATION
   * Transform API data into formats required by charts
   * ─────────────────────────────────────────────────────────────────────────── */
  
  /**
   * Step frequency data for lollipop chart
   * Maps daily step counts with threshold indicator
   */
  const stepFreqData = gaitData.stepFrequencyOverTime.map((d) => ({
    day:   d.day,
    steps: d.steps,
    above: d.steps >= 3000, // Flag for meeting daily step goal
  }));

  /**
   * Arm swing symmetry data for line chart
   * Tracks left and right arm acceleration over time
   */
  const armSwingData = gaitData.armSwingSymmetry.map(d => ({
    time: d.time,
    left: d.left,
    right: d.right,
  }));

  /**
   * Stride length distribution data for stacked bar chart
   * Shows breakdown of ideal, moderate, and suboptimal stride lengths
   */
  const strideData = gaitData.strideLengthDistribution || [];

  /**
   * Dynamic font size calculator for metric values
   * 
   * Adjusts font size based on text length to ensure values fit in fixed-size boxes.
   * Handles different risk level labels (HIGH, MEDIUM, MODERATE) gracefully.
   * 
   * @param {string|number} text - The text to display
   * @param {boolean} isMobile - Mobile breakpoint flag
   * @param {boolean} isTablet - Tablet breakpoint flag
   * @returns {number} Font size in pixels
   */
  const getFontSize = (text, isMobile, isTablet) => {
    const len = String(text).length;
    
    if (len <= 4) {
      // Short text like "HIGH" - full size
      return isMobile ? 28 : isTablet ? 40 : 52;
    }
    if (len <= 6) {
      // Medium text like "MEDIUM" - 65% size
      return isMobile ? 18 : isTablet ? 26 : 34;
    }
    // Long text like "MODERATE" (8 chars) - 40% size to fit in box
    return isMobile ? 12 : isTablet ? 16 : 21;
  };

  /**
   * Metric cards data for the left column
   * Contains key gait metrics with values, units, change percentages, and icons
   */
  const metricCards = [
    { label:"Step Frequency",  val:String(gaitData.metrics.stepFrequency.value),  unit:gaitData.metrics.stepFrequency.unit,  pct:`${gaitData.metrics.stepFrequency.change}%`,  icon:stepFreqIcon  },
    { label:"Stride Length",   val:String(gaitData.metrics.strideLength.value),   unit:gaitData.metrics.strideLength.unit,   pct:`${gaitData.metrics.strideLength.change}%`,   icon:strideLenIcon },
    { label:"Balance Score",   val:`${gaitData.metrics.balanceScore.value}%`,     unit:"steps/min",                          pct:`${gaitData.metrics.balanceScore.change}%`,   icon:balanceIcon   },
    { label:"Fall Risk Level", val:gaitData.metrics.fallRiskLevel.value,          unit:"",                                   pct:"",                                            icon:fallRiskIcon, isRisk:true },
  ];

  /* ───────────────────────────────────────────────────────────────────────────
   * RESPONSIVE LAYOUT CALCULATIONS
   * Compute sizes and spacing based on screen size
   * ─────────────────────────────────────────────────────────────────────────── */
  
  /** Gap between grid items */
  const gap = isMobile ? 8 : 10;
  
  /** Use three-column layout on desktop */
  const threeCol = isDesktop;
  
  /** Card header font size */
  const headerFont = isMobile ? 14 : isTablet ? 16 : 18;
  
  /** Legend text font size */
  const legendFont = isMobile ? 9 : isTablet ? 10 : 12;
  
  /** Metric unit label font size */
  const metricUnit = isMobile ? 10 : isTablet ? 13 : 16;
  
  /** Icon circle diameter */
  const iconCircle = isMobile ? 44 : isTablet ? 56 : 70;
  
  /** Icon image size */
  const iconImg = isMobile ? 24 : isTablet ? 32 : 38;
  
  /** Gauge chart size */
  const gaugeSize = isMobile ? 160 : isTablet ? 200 : 260;

  /* ───────────────────────────────────────────────────────────────────────────
   * RENDER
   * ─────────────────────────────────────────────────────────────────────────── */

  return (
    <main style={{
      flex: 1,

      padding: isMobile ? "10px 10px" : "12px 60px",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap,
      minWidth: 0,
      fontFamily: "'Segoe UI', sans-serif",
      color: W,
      position: "relative",
      zIndex: 1,
      paddingTop: isMobile ? 80 : (showBackButton ? 150 : 140),
      paddingBottom: isMobile ? 10 : 6,
      marginTop: 0,
      height: threeCol ? "100vh" : "auto",
      minHeight: threeCol ? 0 : "100vh",
      boxSizing: "border-box",
    }}>

      {/* Back to Resident Details Button */}
      {showBackButton && onBackToResident && (
        <button
          onClick={onBackToResident}
          style={{
            position: "fixed",
            top: 80,
            left: 20,
            zIndex: 1001,
            background: "rgba(4,37,88,0.95)",
            border: "2px solid #FFFFFF",
            borderRadius: 12,
            padding: "12px 20px",
            color: W,
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(4,37,88,1)";
            e.currentTarget.style.transform = "translateX(-4px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(4,37,88,0.95)";
            e.currentTarget.style.transform = "translateX(0)";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Resident Details
        </button>
      )}

      {/* ── Full-height grid: metric card spans all rows ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: threeCol ? "300px 1fr 1fr" : (isTablet ? "1fr 1fr" : "1fr"),
        gridTemplateRows: threeCol ? "1fr 1fr auto" : "auto",
        gap, flex: threeCol ? 1 : "unset", minHeight: 0, overflow: threeCol ? "hidden" : "visible",
      }}>

        {/* ═══ LEFT COLUMN — spans all rows top to bottom ═══ */}
        <div style={{
          borderRadius: 14,
          background: "#091428",
          border: "2px solid #ffffff",
          padding: isMobile ? 12 : isTablet ? 16 : 24,
          display: "flex",
          flexDirection: isMobile ? "row" : "column",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: isMobile ? 8 : isTablet ? 10 : 16,
          gridRow: threeCol ? "1 / -1" : "auto",
          gridColumn: isTablet && !threeCol ? "1 / -1" : "auto",
        }}>
          {metricCards.map(({ label, val, unit, pct, icon, isRisk }) => (
            <div key={label} style={{
              flex: isMobile ? "1 1 calc(50% - 4px)" : 1,
              minWidth: isMobile ? 130 : "auto",
              background: "linear-gradient(180deg, #1b3352 0%, #1e3a5c 50%, #213f62 100%)",
              borderRadius: 10,
              padding: isMobile ? "6px 8px" : isTablet ? "8px 10px" : "10px 12px",
              display: "flex", flexDirection: "column",
            }}>
              <p style={{ margin:"0 0 3px", fontSize: isMobile ? 11 : isTablet ? 13 : 16, color:W, fontWeight:700, textAlign:"right", fontStyle:"italic" }}>{label}</p>
              <div style={{ display:"flex", alignItems:"stretch", gap: isMobile ? 6 : isTablet ? 8 : 12, flex:1 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, flexShrink:0 }}>
                  <div style={{
                    width: iconCircle, height: iconCircle,
                    borderRadius: "50%", border: "2px solid #ffffff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <img src={icon} alt={label} style={{
                      width: iconImg, height: iconImg,
                      objectFit: "contain", filter: "brightness(0) invert(1)",
                    }}/>
                  </div>
                  {pct && (
                    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
                      <svg width={isMobile ? 9 : 11} height={isMobile ? 9 : 11} viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 5v7H5" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: isMobile ? 9 : 13, fontWeight:700, color:W }}>{pct}</span>
                    </div>
                  )}
                </div>
                <div style={{
                  flex: 1,
                  border: "1.5px solid #ffffff",
                  borderRadius: 10,
                  padding: isMobile ? "4px 8px" : "10px 12px",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  minWidth: 0,
                  overflow: "hidden",
                }}>
                  <span style={{
                    fontSize: getFontSize(val, isMobile, isTablet),
                    fontWeight: 700, 
                    lineHeight: 1,
                    color: isRisk ? "#ff4444" : W,
                    textAlign: "center",
                    width: "100%",
                    padding: "0 4px",
                    boxSizing: "border-box",
                  }}>{val}</span>
                  {unit && <span style={{ fontSize: metricUnit, color: W, opacity: 0.8, marginTop: 2 }}>{unit}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ MIDDLE COLUMN — Step Frequency + Stride Length ═══ */}
        <div style={{ display:"flex", flexDirection:"column", gap, minHeight:0, gridRow: threeCol ? "1 / 3" : "auto" }}>

          {/* Step Frequency Over Time */}
          <GCard p={isMobile ? "8px 10px" : "11px 13px"} style={{ flex: threeCol ? 1 : "unset", minHeight: threeCol ? 0 : isMobile ? 220 : 280 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:isMobile ? "center" : "flex-start", marginBottom:isMobile ? 4 : 8, flexShrink:0 }}>
              <p style={{ margin:0, fontSize:headerFont, color:W, fontWeight:700 }}>Step Frequency Over Time</p>
              {!isMobile && <div style={{ display:"flex", flexDirection:"column", gap:4, fontSize:legendFont, alignItems:"flex-end", color:W }}>
                <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:12, height:12, borderRadius:2, display:"inline-block", background:"#ffffff" }}/>
                  More than 3000 steps
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:12, height:12, borderRadius:2, display:"inline-block", background:"#5b9bd5" }}/>
                  Less than 3000 steps
                </span>
              </div>}
            </div>
            <p style={{ margin:"0 0 2px", fontSize:11, fontWeight:700, color:W, opacity:0.7 }}>STEPS</p>
            <div style={{ flex:1, minHeight:0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stepFreqData} margin={{ top:4, right:4, bottom:0, left:-10 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill:W, fontSize:9 }} axisLine={{ stroke:"#ffffff", strokeWidth:1 }} tickLine={false} />
                  <YAxis tick={{ fill:W, fontSize:10, opacity:0.7 }}
                         axisLine={{ stroke:"#ffffff", strokeWidth:1 }} tickLine={false}
                         domain={[0, 6000]} ticks={[0, 1000, 2000, 3000, 4000, 5000]} />
                  <Bar dataKey="steps" barSize={isMobile ? 4 : 6} shape={<StepLollipop/>} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </GCard>

          {/* Stride Length Distribution */}
          <GCard p={isMobile ? "8px 10px" : "11px 13px"} style={{ flex: threeCol ? 1 : "unset", minHeight: threeCol ? 0 : isMobile ? 200 : 240 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:isMobile ? 4 : 8, flexShrink:0 }}>
              <p style={{ margin:0, fontSize:headerFont, color:W, fontWeight:700 }}>Stride Length Distribution</p>
              {!isMobile && <div style={{ display:"flex", gap:12, fontSize:legendFont, color:W }}>
                <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <span style={{ width:8, height:8, background:"#ffffff", borderRadius:"50%", display:"inline-block" }}/> Ideal
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <span style={{ width:8, height:8, background:"#7ab8f5", borderRadius:"50%", display:"inline-block" }}/> Moderate
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <span style={{ width:8, height:8, background:"#3a6fa5", borderRadius:"50%", display:"inline-block" }}/> Suboptimal
                </span>
              </div>}
            </div>
            <p style={{ margin:"0 0 2px", fontSize:isMobile ? 9 : 11, fontWeight:700, color:W, opacity:0.7 }}>STEPS</p>
            <div style={{ flex:1, minHeight:0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={strideData} margin={{ top:4, right:4, bottom:0, left:-10 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill:W, fontSize:8 }} axisLine={{ stroke:"#ffffff", strokeWidth:1 }} tickLine={false} />
                  <YAxis tick={{ fill:W, fontSize:9, opacity:0.7 }} axisLine={{ stroke:"#ffffff", strokeWidth:1 }} tickLine={false} />
                  <Bar dataKey="ideal" stackId="a" fill="#ffffff" radius={[0,0,0,0]} barSize={isMobile ? 8 : 14} />
                  <Bar dataKey="moderate" stackId="a" fill="#7ab8f5" />
                  <Bar dataKey="suboptimal" stackId="a" fill="#3a6fa5" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GCard>
        </div>

        {/* ═══ RIGHT COLUMN — Arm Swing + Body Tilt ═══ */}
        <div style={{ display:"flex", flexDirection:"column", gap, minHeight:0, gridRow: threeCol ? "1 / 3" : "auto" }}>

          {/* Arm Swing Symmetry */}
          <GCard p={isMobile ? "8px 10px" : "11px 13px"} style={{ flex: threeCol ? 1 : "unset", minHeight: threeCol ? 0 : isMobile ? 200 : 240 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:isMobile ? 4 : 8, flexShrink:0 }}>
              <p style={{ margin:0, fontSize:headerFont, color:W, fontWeight:700 }}>Arm Swing Symmetry</p>
              {!isMobile && (
                <div style={{
                  width:50, height:50, borderRadius:"50%", border:"2px solid #ffffff",
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                }}>
                  <img src={armSwingIcon} alt="Arm Swing" style={{ width:30, height:30, objectFit:"contain", filter:"brightness(0) invert(1)" }}/>
                </div>
              )}
            </div>
            <p style={{ margin:"0 0 2px", fontSize:10, color:W, opacity:0.6 }}>Acceleration (m/s²)</p>
            <div style={{ flex:1, minHeight:0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={armSwingData} margin={{ top:4, right:10, bottom:18, left:-10 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fill:W, fontSize:10, opacity:0.7 }} axisLine={{ stroke:"#ffffff", strokeWidth:1 }} tickLine={false}
                         label={{ value:"Time (s)", position:"insideBottom", dy:8, fontSize:10, fill:W, opacity:0.6 }} reversed />
                  <YAxis domain={[0,5]} ticks={[0,1,2,3,4]} tick={{ fill:W, fontSize:10, opacity:0.7 }} axisLine={{ stroke:"#ffffff", strokeWidth:1 }} tickLine={false} />
                  <Line type="monotone" dataKey="left" stroke="#ffffff" strokeWidth={2} dot={{ r:3, fill:"#ffffff" }} name="Left Arm" isAnimationActive={false}/>
                  <Line type="monotone" dataKey="right" stroke="#7ab8f5" strokeWidth={2} dot={{ r:3, fill:"#7ab8f5" }} name="Right Arm" isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GCard>

          {/* Body Tilt Analysis — redesigned layout */}
          <GCard p={isMobile ? "10px 10px" : "12px 14px"} style={{ flex: threeCol ? 1 : "unset", minHeight: threeCol ? 0 : isMobile ? 220 : 260 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:isMobile ? 4 : 6, flexShrink:0 }}>
              <div>
                <p style={{ margin:"0 0 6px", fontSize:headerFont, color:W, fontWeight:700 }}>Body Tilt Analysis</p>
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  {[["#1a6fb5","Normal tilt"],["#3ea8d5","Slight imbalance"],["#c5e4f3","Significant tilt"]].map(([c,l])=>(
                    <span key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:isMobile ? 9 : legendFont, color:W, opacity:0.85 }}>
                      <span style={{ width:8, height:8, background:c, borderRadius:"50%", display:"inline-block" }}/>
                      {l}
                    </span>
                  ))}
                </div>
              </div>
              {/* 3-figure icon top-right */}
              <div style={{ display:"flex", alignItems:"flex-end", gap:0, flexShrink:0 }}>
                <img src={bodyTiltIcon} alt="" style={{
                  width:28, height:50, objectFit:"contain",
                  filter:"brightness(0) invert(1)", opacity:0.3,
                  transform:"rotate(12deg)", transformOrigin:"bottom center", marginRight:-3,
                }}/>
                <img src={bodyTiltIcon} alt="Body Tilt" style={{
                  width:36, height:65, objectFit:"contain",
                  filter:"brightness(0) invert(1)", opacity:1,
                  position:"relative", zIndex:1,
                }}/>
                <img src={bodyTiltIcon} alt="" style={{
                  width:28, height:50, objectFit:"contain",
                  filter:"brightness(0) invert(1)", opacity:0.3,
                  transform:"rotate(-12deg)", transformOrigin:"bottom center", marginLeft:-3,
                }}/>
              </div>
                </div>

            {/* Gauge centered */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:0 }}>
              <GaugeChart value={gaitData.bodyTilt.value} size={gaugeSize} />
              <p style={{ margin:"-2px 0 4px", fontSize: isMobile ? 14 : 20, fontWeight:700, color:W }}>{gaitData.bodyTilt.label}</p>
              <div style={{ display:"flex", justifyContent:"space-between", width: isMobile ? 140 : isTablet ? 180 : 240 }}>
                <span style={{ fontSize: isMobile ? 11 : 16, fontWeight:600, color:W }}>{gaitData.bodyTilt.leftLabel}</span>
                <span style={{ fontSize: isMobile ? 11 : 16, fontWeight:600, color:W }}>{gaitData.bodyTilt.rightLabel}</span>
              </div>
            </div>
          </GCard>
        </div>
        {/* ── Bottom Insights — one outer container with 3 inner divs ── */}
        <GCard p={isMobile ? "12px" : "16px"} style={{
          gridColumn: threeCol ? "2 / 4" : "1 / -1",
          minHeight: isMobile ? "auto" : 140,
        }}>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? 8 : 12, height:"100%" }}>
            {[
              { title:"Recent Alerts",     text: gaitData.insights.recentAlerts },
              { title:"Recommendations",   text: gaitData.insights.recommendations },
              { title:"Fall Risk Summary", text: gaitData.insights.fallRiskSummary },
            ].map(({ title, text }) => (
              <div key={title} style={{
                background: "linear-gradient(180deg, #122a4a 0%, #153560 50%, #183d6e 100%)",
                borderRadius: 10,
                border: "none",
                padding: isMobile ? "10px 10px" : "16px 18px",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                textAlign: "center", gap: isMobile ? 5 : 8,
              }}>
                <span style={{
                  display:"inline-block", background:"rgba(255,255,255,0.12)",
                  border:"1px solid rgba(255,255,255,0.25)",
                  borderRadius:8, padding:isMobile ? "3px 10px" : "5px 16px", fontSize:isMobile ? 12 : 15, fontWeight:700, color:W,
                }}>{title}</span>
                <span style={{ fontSize:isMobile ? 12 : 15, color:W, opacity:0.85, lineHeight:1.6 }}>{text}</span>
              </div>
            ))}
          </div>
        </GCard>
      </div>
    </main>
  );
}
