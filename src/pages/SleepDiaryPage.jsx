import { useState }   from "react";
import wakeIcon       from "../assets/wake_icon.svg";
import totalSleepIcon from "../assets/total_sleep_time.svg";
import efficiencyIcon from "../assets/sleep_efficiency.svg";
import latencyIcon    from "../assets/sleep_latency.svg";
import wasoIcon       from "../assets/wake_after_sleep.svg";
import useWindowSize  from "../hooks/useWindowSize";
import sleepData      from "../data/sleepData.json";
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";

/* ═══════════════════════ DATA (from sleepData.json) ═══════════════════════ */
const sleepDurationData = sleepData.sleepDurationOverTime.map(d => ({
  day: d.day, hours: d.hours, q: d.quality,
}));

const movementRaw = sleepData.bodyMovement.map(d => ({
  t: d.time, h: d.value,
}));

const wakeEpisodes = sleepData.wakeEpisodes.map(d => ({
  label: d.label, dur: d.duration, wakeTime: d.wakeTime, wakeDur: d.wakeDur,
}));

const stagesData = [
  { name:"REM Sleep",   value:sleepData.sleepStages.remSleep,   color:"#5bb8e8" },
  { name:"Light Sleep", value:sleepData.sleepStages.lightSleep, color:"#c5e4f3" },
  { name:"Deep Sleep",  value:sleepData.sleepStages.deepSleep,  color:"#1a6fb5" },
];

const totalSleepHours = Math.floor(sleepData.sleepStages.totalMinutes / 60);
const totalSleepMins  = sleepData.sleepStages.totalMinutes;

const metricCards = [
  { label:"Total Sleep Time",       val:String(sleepData.metrics.totalSleepTime.value),       unit:sleepData.metrics.totalSleepTime.unit,       pct:`${sleepData.metrics.totalSleepTime.change}%`,       icon:totalSleepIcon },
  { label:"Sleep Efficiency",       val:String(sleepData.metrics.sleepEfficiency.value),      unit:sleepData.metrics.sleepEfficiency.unit,      pct:`${sleepData.metrics.sleepEfficiency.change}%`,      icon:efficiencyIcon },
  { label:"Wake After Sleep\nOnset", val:String(sleepData.metrics.wakeAfterSleepOnset.value),  unit:sleepData.metrics.wakeAfterSleepOnset.unit,  pct:`${sleepData.metrics.wakeAfterSleepOnset.change}%`,  icon:wasoIcon },
  { label:"Sleep Latency",          val:String(sleepData.metrics.sleepLatency.value),         unit:sleepData.metrics.sleepLatency.unit,         pct:`${sleepData.metrics.sleepLatency.change}%`,         icon:latencyIcon },
];

/* ═══════════════════════ HELPERS ════════════════════════════════════════ */
const W = "#ffffff";

/* Lollipop shape: thin line + white filled circle on top */
const LollipopBar = ({ x, y, width, height }) => {
  const cx = x + width / 2;
  return (
    <g>
      <line x1={cx} y1={y + height} x2={cx} y2={y + 6} stroke="#ffffff" strokeWidth={2}/>
      <circle cx={cx} cy={y + 4} r={5} fill="#ffffff"/>
    </g>
  );
};

/* Simple white dot for sleep duration (no smiley) */
const SimpleDot = (props) => {
  const { cx, cy } = props;
  return <circle cx={cx} cy={cy} r={5} fill="#ffffff" stroke="#ffffff" strokeWidth={1}/>;
};

const GCard = ({ children, style = {}, p = "13px 15px" }) => (
  <div style={{
    position:"relative", borderRadius:11,
    background:"linear-gradient(180deg, #0a1a30 0%, #0e2240 40%, #112a50 100%)",
    border:"1px solid #ffffff",
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

const Pill = ({ children }) => (
  <span style={{
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    border:"1.5px solid rgba(255,255,255,0.55)", borderRadius:999,
    padding:"2px 9px", fontSize:9, color:"#ffffff",
    whiteSpace:"nowrap", background:"transparent",
    letterSpacing:0.2, minWidth:48,
  }}>
    {children}
  </span>
);

/* ═══════════════════════ PAGE ════════════════════════════════════════════ */
export default function SleepDiaryPage() {
  const [date] = useState(sleepData.patient.date);
  const { isMobile, isTablet, isDesktop } = useWindowSize();

  const gap           = isMobile ? 8 : 10;
  const threeCol      = isDesktop;
  const donutInner    = isMobile ? 40 : isTablet ? 50 : 60;
  const donutOuter    = isMobile ? 58 : isTablet ? 68 : 82;
  const donutHeight   = isMobile ? 140 : isTablet ? 170 : 200;
  const headerFont    = isMobile ? 14 : isTablet ? 16 : 18;
  const wakeRightW    = isMobile ? 60 : isTablet ? 80 : 110;

  return (
    <main style={{
      flex: 1,
      padding: isMobile ? "10px 10px" : "12px 16px",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: gap,
      minWidth: 0,
      /* push content below the top nav bar */
      paddingTop: isMobile ? 56 : 68,
    }}>

      {/* ── Main Grid: 3 columns on desktop ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: threeCol ? "300px 1fr 1fr" : (isTablet ? "1fr 1fr" : "1fr"),
        gap: gap,
        flex: 1,
        minHeight: 0,
      }}>

                                {/* ══════ LEFT COLUMN — Dark outer container, 4 lighter-blue inner boxes ══════ */}
        <div style={{
                    borderRadius: 14,
          background: "#091428",
                    border: "2px solid #ffffff",
                                        padding: isMobile ? 12 : isTablet ? 16 : 24,
          display: "flex",
          flexDirection: isMobile ? "row" : "column",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: isMobile ? 8 : isTablet ? 10 : 16,
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
              {/* Row 1: Label top-left, pure-white circle top-right */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: isMobile ? 2 : 4 }}>
                <span style={{
                  fontSize: isMobile ? 11 : 15, color:W, fontWeight:700,
                  lineHeight:1.25, whiteSpace:"pre-line",
                }}>{label}</span>
                <div style={{
                  width: isMobile ? 36 : isTablet ? 42 : 50, height: isMobile ? 36 : isTablet ? 42 : 50,
                  borderRadius: "50%",
                  border: "2px solid #ffffff",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginLeft: 6,
                }}>
                  <span style={{ fontSize: isMobile ? 9 : 13, fontWeight:700, color:W, lineHeight:1 }}>{pct}</span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginTop:1 }}>
                    <path d="M4 4l8 8M12 5v7H5" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              {/* Row 2: Icon ··· gap ··· Big number + unit */}
              <div style={{ display:"flex", alignItems:"flex-end", gap: isMobile ? 12 : 16 }}>
                <img src={icon} alt={label} style={{
                  width: isMobile ? 36 : isTablet ? 50 : 60, height: isMobile ? 36 : isTablet ? 50 : 60,
                  objectFit:"contain", flexShrink:0,
                }}/>
                <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                                    <span style={{ fontSize: isMobile ? 28 : isTablet ? 40 : 52, fontWeight:700, color:W, lineHeight:1 }}>{val}</span>
                  <span style={{ fontSize: isMobile ? 11 : isTablet ? 14 : 18, color:W, opacity:0.85, fontWeight:500 }}>{unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ══════════ MIDDLE COLUMN — Sleep Stages + Body Movement ══════════ */}
        <div style={{ display:"flex", flexDirection:"column", gap:gap, minHeight:0 }}>

                    {/* Sleep Stages Distribution */}
          <GCard p="14px 14px" style={{ flex: threeCol ? 1 : "unset", minHeight: threeCol ? 0 : "auto" }}>
            <p style={{ margin:"0 0 8px", fontSize:headerFont, color:W, fontWeight:700 }}>Sleep Stages Distribution</p>

                        {/* Row: [Deep label] | [Donut] | [REM label] */}
            <div style={{ display:"flex", alignItems:"center", gap:0, flex:1, minHeight:0 }}>

              {/* Left — Deep Sleep with connector line */}
              <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, paddingRight:0 }}>
                <span style={{ fontSize:13, color:W, fontWeight:600, fontStyle:"italic" }}>Deep Sleep</span>
                <span style={{ fontSize:18, color:W, fontWeight:700 }}>{sleepData.sleepStages.deepSleep}%</span>
              </div>
              {/* Connector line left */}
              <div style={{ width:20, height:2, background:W, flexShrink:0 }}/>

              {/* Centre — bigger donut */}
              <div style={{ flex:1, position:"relative" }}>
                <ResponsiveContainer width="100%" height={donutHeight}>
                  <PieChart>
                    <Pie data={stagesData} cx="50%" cy="50%"
                         innerRadius={donutInner} outerRadius={donutOuter}
                         startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                      {stagesData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)",
                              width:"50%", height:16, pointerEvents:"none",
                              background:"radial-gradient(ellipse, rgba(21,120,190,0.55) 0%, transparent 70%)",
                              filter:"blur(5px)" }}/>
              </div>

              {/* Connector line right */}
              <div style={{ width:20, height:2, background:W, flexShrink:0 }}/>
              {/* Right — REM Sleep with connector line */}
              <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4, paddingLeft:0 }}>
                <span style={{ fontSize:13, color:W, fontWeight:600, fontStyle:"italic" }}>REM Sleep</span>
                <span style={{ fontSize:18, color:W, fontWeight:700 }}>{sleepData.sleepStages.remSleep}%</span>
              </div>
            </div>

            {/* Light Sleep below the donut with connector line */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, marginTop:0, flexShrink:0 }}>
              <div style={{ width:2, height:16, background:W }}/>
              <span style={{ fontSize:16, color:W, fontWeight:700 }}>{sleepData.sleepStages.lightSleep}%</span>
              <span style={{ fontSize:13, color:W, fontWeight:600, fontStyle:"italic" }}>Light Sleep</span>
            </div>

            <p style={{ margin:"8px 0 0", textAlign:"center", fontSize:14, color:W, opacity:0.7, fontStyle:"italic", flexShrink:0 }}>
              Total sleep time of {totalSleepHours} hours ({totalSleepMins} minutes)
            </p>
          </GCard>

                    {/* Body Movement — lollipop chart (lines + white circles) */}
          <GCard p="14px 14px" style={{ flex: threeCol ? 1 : "unset", minHeight: threeCol ? 0 : 260 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, flexShrink:0 }}>
              <p style={{ margin:0, fontSize:headerFont, color:W, fontWeight:700 }}>Body Movement Analysis</p>
              <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"flex-end" }}>
                {[["#ffffff","No Movement"],["#1578be","Moderate Movement"],["#0a2240","High Movement"]].map(([c,l])=>(
                  <span key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:W }}>
                    <span style={{ width:10, height:10, background:c, border:"1px solid rgba(255,255,255,0.3)", borderRadius:2, display:"inline-block" }}/>
                    {l}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flex:1, minHeight:0 }}>
                            <div style={{ width:10, borderRadius:4, flexShrink:0,
                            background:"linear-gradient(to bottom, #0a2240 0%, #1578be 50%, #ffffff 100%)" }}/>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={movementRaw} barCategoryGap="30%" margin={{ bottom:0, top:12, left:0, right:4 }}>
                  <XAxis dataKey="t" tick={{ fill:"#ffffff", fontSize:isMobile?9:11, fontStyle:"italic" }} axisLine={{ stroke:"rgba(255,255,255,0.15)" }} tickLine={false}/>
                  <YAxis hide/>
                  <Bar dataKey="h" shape={<LollipopBar/>}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GCard>
        </div>

        {/* ══════════ RIGHT COLUMN — Sleep Duration + Wake Episodes ══════════ */}
        <div style={{ display:"flex", flexDirection:"column", gap:gap, minHeight:0 }}>

                    {/* Sleep Duration */}
          <GCard p="14px 14px" style={{ flex: threeCol ? 1 : "unset", minHeight: threeCol ? 0 : 280 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4, flexShrink:0 }}>
              <div>
                <p style={{ margin:"0", fontSize:headerFont, color:W, fontWeight:700, display:"inline" }}>Sleep Duration Over Time</p>
                <p style={{ margin:"4px 0 0", fontSize:13, color:W, opacity:0.8 }}>Hrs</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"flex-end" }}>
                {["Good Sleep","Average Sleep","Poor Sleep"].map(label=>(
                  <span key={label} style={{ display:"flex", alignItems:"center", gap:4, fontSize:isMobile?9:11, color:W, opacity:0.85 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5"/>
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ position:"relative", flex:1, minHeight:0, height: threeCol ? "100%" : 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sleepDurationData} margin={{ top:8, right:12, bottom:18, left:0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" vertical={false}/>
                  <XAxis dataKey="day"
                         tick={{ fill:"#ffffff", fontSize:11, fontWeight:600 }}
                         axisLine={{ stroke:"#ffffff", strokeWidth:1.5 }}
                         tickLine={false}
                         label={{ value:"Days", position:"insideBottomLeft", dx:-4, dy:14, fill:"#ffffff", fontSize:11, fontStyle:"italic" }}/>
                  <YAxis domain={[0,8]} ticks={[0,1,2,3,4,5,6,7,8]}
                         tick={{ fill:"#ffffff", fontSize:11 }} axisLine={{ stroke:"#ffffff", strokeWidth:1.5 }} tickLine={false} width={22}/>
                  <Line type="linear" dataKey="hours" stroke="#ffffff" strokeWidth={2}
                        dot={<SimpleDot/>} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GCard>

                    {/* Wake Episodes — lines with white circles at end */}
          <GCard p="14px 14px" style={{ flex: threeCol ? 1 : "unset", minHeight: threeCol ? 0 : 320 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5, flexShrink:0 }}>
              <p style={{ margin:0, fontSize:headerFont, color:W, fontWeight:700 }}>Wake Episodes</p>
              <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                <div style={{ display:"flex", gap:8, paddingRight:2 }}>
                  <span style={{ fontSize:11, color:W, minWidth:60, textAlign:"center" }}>Time</span>
                  <span style={{ fontSize:11, color:W, minWidth:48, textAlign:"center" }}>Duration</span>
                </div>
                {wakeEpisodes.filter(e=>e.wakeTime).map(({ wakeTime, wakeDur },i)=>(
                  <div key={i} style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <Pill>{wakeTime}</Pill>
                    <Pill>{wakeDur}</Pill>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
              <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"space-evenly", minHeight:0 }}>
                {wakeEpisodes.map(({ label, dur }, idx) => (
                  <div key={idx} style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ width:34, fontSize:11, color:W, flexShrink:0, textAlign:"right" }}>{label}</span>
                    <div style={{ flex:1, height:12, position:"relative", display:"flex", alignItems:"center" }}>
                      {dur > 0 ? (
                        <>
                          {/* Thin line */}
                          <div style={{ width:`${(dur/60)*100}%`, height:2,
                                        background:"#ffffff", minWidth:16 }}/>
                          {/* White circle at end of line */}
                          <div style={{
                            width:10, height:10, borderRadius:"50%",
                            background:"#ffffff", flexShrink:0,
                            marginLeft:-1,
                          }}/>
                          {/* Wake icon after circle */}
                          <div style={{
                            display:"flex", alignItems:"center", marginLeft:2,
                          }}>
                            <img src={wakeIcon} alt="Wake" style={{
                              width:isMobile ? 22 : 30, height:isMobile ? 22 : 30, objectFit:"contain",
                              filter:"brightness(0) invert(1)",
                              border:"none", display:"block",
                            }}/>
                          </div>
                        </>
                      ) : (
                        <div style={{ width:"100%", height:1, background:"rgba(255,255,255,0.07)" }}/>
                      )}
                    </div>
                                        <div style={{ width:wakeRightW, flexShrink:0 }}/>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between",
                            paddingLeft:34, paddingRight:wakeRightW, marginTop:4, flexShrink:0 }}>
                {["0Min","10Min","20Min","30Min","40Min","50Min","60Min"].map(l=>(
                  <span key={l} style={{ fontSize:isMobile?8:10, color:"#ffffff", fontWeight:600 }}>{l}</span>
                ))}
              </div>
            </div>
          </GCard>
        </div>
      </div>
    </main>
  );
}