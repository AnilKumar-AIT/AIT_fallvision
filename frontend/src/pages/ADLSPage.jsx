import { useState, useEffect } from "react";
import sitIcon from "../assets/Sit.svg";
import walkIcon from "../assets/gait.svg";
import standIcon from "../assets/Stand.svg";
import useWindowSize from "../hooks/useWindowSize";
import apiService from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer,
} from "recharts";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const RESIDENT_ID = "RES#res-20251112-0001"; // Default resident for demo
const W = "#ffffff";

/* ═══════════════════════ HELPERS ═══════════════════════ */
const GCard = ({ children, style = {}, p = "20px" }) => (
  <div style={{
    position:"relative", borderRadius:14,
    background:"linear-gradient(180deg, #0a1a30 0%, #0e2240 40%, #112a50 100%)",
    border:"2px solid #ffffff",
    overflow:"hidden", padding:p, ...style,
  }}>
    <div style={{
      position:"absolute", bottom:0, left:0, right:0, height:"55%",
      background:"linear-gradient(to top, rgba(10,55,130,0.45) 0%, transparent 100%)",
      pointerEvents:"none", zIndex:0,
    }}/>
    <div style={{ position:"relative", zIndex:1, height:"100%", display:"flex", flexDirection:"column" }}>
      {children}
    </div>
  </div>
);

/* Custom Bar Shape - thin bars with white color */
const CustomBar = ({ x, y, width, height, fill }) => {
  return <rect x={x} y={y} width={width} height={height} fill="#ffffff" rx={2} />;
};

/* ═══════════════════════ PAGE ═══════════════════════ */
export default function ADLSPage({ residentId, showBackButton, onBackToResident }) {
  const [adlsData, setAdlsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isMobile } = useWindowSize();

  // Use passed residentId or default
  const activeResidentId = residentId || RESIDENT_ID;

  const loadADLSData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiService.getADLSData(activeResidentId);
      
      setAdlsData(data);
    } catch (err) {
      console.error('Failed to load ADLS data:', err);
      console.error('Resident ID that failed:', activeResidentId);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadADLSData(); }, [activeResidentId]);

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
        <LoadingSpinner message="Loading ADLs data..." />
      </main>
    );
  }

  if (error || !adlsData) {
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
        <ErrorMessage error={error} onRetry={loadADLSData} residentId={activeResidentId} />
      </main>
    );
  }

  return (
    <main style={{
      flex: 1,
      padding: isMobile ? "8px 8px 8px 8px" : "8px 60px 8px 60px",
      overflowY: "hidden",
      display: "flex",
      flexDirection: "column",
      gap: isMobile ? 8 : 10,
      minWidth: 0,
      position: "relative",
      zIndex: 1,
      paddingTop: isMobile ? 82 : (showBackButton ? 150 : 130),
      paddingBottom: 8,
      height: "100vh",
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

      {/* ── Activity Cards ── */}
      {['sit', 'walk', 'stand'].map((activity) => {
        const activityData = adlsData[activity];
        const icon = activity === 'sit' ? sitIcon : activity === 'walk' ? walkIcon : standIcon;
        const activityName = activity.charAt(0).toUpperCase() + activity.slice(1);
        
        return (
          <div key={activity} style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "300px 1fr",
            gap: isMobile ? 8 : 10,
            flex: 1,
            minHeight: 0,
          }}>
            {/* Left side - Info Card */}
            <GCard p={isMobile ? "12px" : "14px 18px"}>
              <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                {/* Left side - Activity details */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: isMobile ? 8 : 10 }}>
                  <p style={{ margin: 0, fontSize: isMobile ? 16 : 20, fontWeight: 700, color: W }}>
                    Activity : {activityName}
                  </p>
                  
                  {/* Senior badge */}
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                  }}>
                    <div style={{
                      display: "inline-block",
                      background: "linear-gradient(135deg, #1a7fb5 0%, #2a9fd5 100%)",
                      border: "1.5px solid #ffffff",
                      borderRadius: 6,
                      padding: "4px 12px",
                    }}>
                      <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: W }}>Senior</span>
                    </div>
                  </div>
                  
                  {/* Name */}
                  <p style={{ margin: 0, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: W }}>
                    {adlsData.residentName}
                  </p>
                  
                                    {/* Duration info */}
                  <div style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    padding: isMobile ? "8px 10px" : "8px 12px",
                  }}>
                    <p style={{ margin: "0 0 4px", fontSize: 10, color: W, opacity: 0.7 }}>
                      Today's Total {activityName}ing Duration
                    </p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: W }}>
                        {activityData.totalDuration.hours}Hrs
                      </span>
                      <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: W }}>
                        {activityData.totalDuration.minutes}Mins
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Right side - Large icon with white ring */}
                <div style={{
                  width: isMobile ? 90 : 110,
                  height: isMobile ? 90 : 110,
                  borderRadius: "50%",
                  border: "3px solid #ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: isMobile ? 8 : 12,
                  flexShrink: 0,
                }}>
                  <img src={icon} alt={activityName} style={{
                    width: "65%",
                    height: "65%",
                    objectFit: "contain",
                    filter: "brightness(0) invert(1)",
                  }}/>
                </div>
              </div>
            </GCard>

            {/* Right side - Chart */}
            <GCard p={isMobile ? "12px" : "14px 16px"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: W }}>Mins</span>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={isMobile ? 140 : 160}>
                <BarChart data={activityData.chartData} margin={{ top: 8, right: 8, left: -10, bottom: 16 }} barGap={6}>
                  <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fill: W, fontSize: isMobile ? 9 : 11, fontStyle: "italic" }} 
                    axisLine={{ stroke: "#ffffff", strokeWidth: 1.5 }} 
                    tickLine={false}
                    label={{ value: "Time", position: "insideBottom", offset: -10, fill: W, fontSize: 11, fontStyle: "italic" }}
                  />
                  <YAxis 
                    domain={[0, 60]} 
                    ticks={[0, 10, 20, 30, 40, 50, 60]}
                    tick={{ fill: W, fontSize: isMobile ? 9 : 11 }} 
                    axisLine={{ stroke: "#ffffff", strokeWidth: 1.5 }} 
                    tickLine={false}
                  />
                  <Bar 
                    dataKey="duration" 
                    fill="#ffffff" 
                    shape={<CustomBar/>}
                    barSize={isMobile ? 8 : 12}
                  />
                </BarChart>
              </ResponsiveContainer>
            </GCard>
          </div>
        );
      })}
    </main>
  );
}
