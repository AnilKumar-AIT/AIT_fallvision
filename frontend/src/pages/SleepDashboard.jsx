import { useState } from "react";
import aitLogo from "../assets/ait.svg";
import gaitIcon from "../assets/gait.svg";
import wakeIcon from "../assets/wake_icon.svg";
import adlIcon from "../assets/ADL.svg";
import fallsIcon from "../assets/falls.svg";
import homeIcon from "../assets/home.svg";
import sleepDiaryIcon from "../assets/sleep_diary.svg";
import seniorsIcon from "../assets/seniors.svg";
import caregiversIcon from "../assets/caregivers.svg";
import totalSleepIcon from "../assets/total_sleep_time.svg";
import efficiencyIcon from "../assets/sleep_efficiency.svg";
import latencyIcon from "../assets/sleep_latency.svg";
import wasoIcon from "../assets/wake_after_sleep.svg";
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";

/* ══════════════════════════════ DATA ══════════════════════════════════════ */
const sleepDurationData = [
  { day:"1", hours:5, q:"avg"  },
  { day:"2", hours:8, q:"good" },
  { day:"3", hours:6, q:"avg"  },
  { day:"4", hours:3, q:"poor" },
  { day:"5", hours:5, q:"avg"  },
  { day:"6", hours:8, q:"good" },
  { day:"7", hours:5, q:"avg"  },
];

const movementRaw = [
  { t:"10Pm",h:15 },{ t:"11Pm",h:22 },{ t:"12Am",h:58 },
  { t:"1Am", h:72 },{ t:"2Am", h:92 },{ t:"3Am", h:100},
  { t:"4Am", h:85 },{ t:"4:30",h:60 },{ t:"5Am", h:36 },
  { t:"5:30",h:20 },{ t:"6Am", h:12 },
];

const wakeEpisodes = [
  { label:"6Am",  dur:46, wakeTime:"10:30Pm", wakeDur:"10min" },
  { label:"5Am",  dur:0,  wakeTime:null,       wakeDur:null    },
  { label:"4Am",  dur:0,  wakeTime:null,       wakeDur:null    },
  { label:"3Am",  dur:46, wakeTime:"12:50Am",  wakeDur:"20min" },
  { label:"2am",  dur:0,  wakeTime:null,       wakeDur:null    },
  { label:"1Am",  dur:32, wakeTime:"02:50Am",  wakeDur:"30min" },
  { label:"12Am", dur:0,  wakeTime:null,       wakeDur:null    },
  { label:"11pm", dur:20, wakeTime:"05:20Am",  wakeDur:"20min" },
  { label:"10pm", dur:0,  wakeTime:null,       wakeDur:null    },
];

const stagesData = [
  { name:"REM Sleep",   value:25, color:"#22a8d4" },  // top-right arc
  { name:"Light Sleep", value:50, color:"#1578be" },  // bottom arc
  { name:"Deep Sleep",  value:25, color:"#0a2240" },  // top-left arc
];

/* ══════════════════════════════ NAV ICONS ══════════════════════════════════ */
const NavIcons = {
  Home:        () => <img src={homeIcon}       alt="Home"        style={{ width:26, height:26, filter:"brightness(0) invert(1)" }} />,
  Falls:       () => <img src={fallsIcon}      alt="Falls"       style={{ width:26, height:26, filter:"brightness(0) invert(1)" }} />,
  ADLs:        () => <img src={adlIcon}        alt="ADLs"        style={{ width:26, height:26, filter:"brightness(0) invert(1)" }} />,
  "Sleep Diary":()=> <img src={sleepDiaryIcon} alt="Sleep Diary" style={{ width:26, height:26, filter:"brightness(0) invert(1)" }} />,
  Gait:        () => <img src={gaitIcon}       alt="Gait"        style={{ width:26, height:26, filter:"brightness(0) invert(1)" }} />,
  Seniors:     () => <img src={seniorsIcon}    alt="Seniors"     style={{ width:26, height:26, filter:"brightness(0) invert(1)" }} />,
  Caregivers:  () => <img src={caregiversIcon} alt="Caregivers"  style={{ width:26, height:26, filter:"brightness(0) invert(1)" }} />,
};

/* ════════════════════════ CHART HELPERS ════════════════════════════════════ */
const MovBar = ({ x, y, width, height }) => (
  <rect x={x} y={y} width={width} height={height} fill="#ffffff" rx={1}/>
);

const LineDot = (props) => {
  const { cx, cy, payload } = props;
  const q = payload?.q || "avg";
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="#08131f" stroke="#ffffff" strokeWidth={1.6}/>
      <circle cx={cx-3} cy={cy-2} r={1} fill="white"/>
      <circle cx={cx+3} cy={cy-2} r={1} fill="white"/>
      {q==="good" && <path d={`M${cx-4} ${cy+2} Q${cx} ${cy+6} ${cx+4} ${cy+2}`} stroke="white" strokeWidth={1.2} fill="none" strokeLinecap="round"/>}
      {q==="avg"  && <line x1={cx-4} y1={cy+3} x2={cx+4} y2={cy+3} stroke="white" strokeWidth={1.2} strokeLinecap="round"/>}
      {q==="poor" && <path d={`M${cx-4} ${cy+5} Q${cx} ${cy+2} ${cx+4} ${cy+5}`} stroke="white" strokeWidth={1.2} fill="none" strokeLinecap="round"/>}
    </g>
  );
};

/* ════════════════════════ GLOW CARD WRAPPER ════════════════════════════════ */
const GCard = ({ children, style = {}, p = "13px 15px" }) => (
  <div style={{
    position:"relative", borderRadius:11,
    background:"#0c1825",
    border:"1px solid #192e47",
    overflow:"hidden",
    padding:p,
    ...style,
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

/* ════════════════════ PILL BADGE ════════════════════════════════════════════ */
const Pill = ({ children }) => (
  <span style={{
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    border:"1.5px solid rgba(255,255,255,0.55)",
    borderRadius:999,
    padding:"2px 9px",
    fontSize:9,
    color:"#ffffff",
    whiteSpace:"nowrap",
    background:"transparent",
    letterSpacing:0.2,
    minWidth:48,
  }}>
    {children}
  </span>
);

const W = "#ffffff";

/* ════════════════════════ DASHBOARD ════════════════════════════════════════ */
export default function SleepDashboard() {
  const [date] = useState("February 4, 2025");
  const navItems = ["Home","Falls","ADLs","Sleep Diary","Gait","Seniors","Caregivers"];

  return (
    <div style={{ display:"flex", height:"100vh", background:"#060c16",
                  fontFamily:"'Segoe UI',sans-serif", color:W, fontSize:13,
                  overflow:"hidden" }}>

      {/* ══════════════════════ SIDEBAR ═════════════════════════════════════ */}
      <aside style={{
        width:185, background:"#07101b", flexShrink:0,
        borderRight:"1px solid #122030",
        display:"flex", flexDirection:"column",
        alignItems:"stretch", paddingTop:14, paddingBottom:8,
      }}>

        {/* Logo */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:18 }}>
          <img src={aitLogo} alt="AIT Logo" style={{ width:155, height:155, objectFit:"contain" }} />
        </div>

        {/* Nav items — icon + label side by side */}
        <nav style={{ width:"100%", flex:1, display:"flex", flexDirection:"column" }}>
          {navItems.map(item => {
            const Icon = NavIcons[item] || (()=>null);
            const active = item === "Sleep Diary";
            return (
              <div key={item} style={{
                display:"flex", flexDirection:"row", alignItems:"center",
                padding:"10px 14px",
                cursor:"pointer", gap:12,
                background: active ? "rgba(26,120,200,0.14)" : "transparent",
                borderLeft: active ? "3px solid #2090d0" : "3px solid transparent",
              }}>
                <span style={{ color:W, opacity:active?1:0.75, flexShrink:0 }}><Icon/></span>
                <span style={{
                  fontSize:13, color:W,
                  fontWeight: active ? 600 : 400,
                  opacity: active ? 1 : 0.75,
                }}>
                  {item}
                </span>
              </div>
            );
          })}
        </nav>

        {/* Bottom 4 icons — raised with paddingBottom */}
        <div style={{
          display:"flex", gap:6,
          justifyContent:"center",
          alignItems:"center",
          paddingTop:10,
          paddingBottom:18,
          borderTop:"1px solid rgba(255,255,255,0.07)",
          marginTop:8,
        }}>
          {/* Grid */}
          <div style={{ width:30, height:30, background:"rgba(255,255,255,0.12)",
                        borderRadius:7, display:"flex", alignItems:"center",
                        justifyContent:"center", cursor:"pointer" }}>
            <svg width="15" height="15" viewBox="0 0 14 14" fill="white">
              <rect x="0" y="0" width="5.5" height="5.5" rx="1"/>
              <rect x="8.5" y="0" width="5.5" height="5.5" rx="1"/>
              <rect x="0" y="8.5" width="5.5" height="5.5" rx="1"/>
              <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/>
            </svg>
          </div>
          {/* Expand */}
          <div style={{ width:30, height:30, background:"rgba(255,255,255,0.12)",
                        borderRadius:7, display:"flex", alignItems:"center",
                        justifyContent:"center", cursor:"pointer" }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
                 stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2h4v4M14 2l-5 5M6 14H2v-4M2 14l5-5"/>
            </svg>
          </div>
          {/* Bell */}
          <div style={{ width:30, height:30, display:"flex", alignItems:"center",
                        justifyContent:"center", cursor:"pointer" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="white" strokeWidth="1.7" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </div>
          {/* User */}
          <div style={{ width:30, height:30, display:"flex", alignItems:"center",
                        justifyContent:"center", cursor:"pointer" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="white" strokeWidth="1.7" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="9"  r="3"/>
              <path d="M6.2 19.4a6 6 0 0111.6 0"/>
            </svg>
          </div>
        </div>
      </aside>

      {/* ══════════════════════ MAIN ═════════════════════════════════════════ */}
      <main style={{ flex:1, padding:"13px 15px", overflowY:"auto",
                     display:"flex", flexDirection:"column", gap:9,
                     minWidth:0, height:"100vh" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h1 style={{ margin:0, fontSize:19, fontWeight:700, color:W, letterSpacing:0.2 }}>
            Daily Sleep-Wake Disorders Dashboard
          </h1>
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ background:"rgba(6,12,22,0.8)", border:"2px solid #ffffff",
                          borderRadius:10, padding:"6px 14px",
                          display:"flex", alignItems:"center", gap:8,
                          fontSize:13, color:W, cursor:"pointer", fontWeight:500 }}>
              {date}
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ background:"#177080", borderRadius:10, padding:"6px 14px",
                          display:"flex", alignItems:"center", gap:8,
                          fontSize:13, color:W, cursor:"pointer", fontWeight:500 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              Patient/User ID
            </div>
          </div>
        </div>

        {/* Two-column grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, flex:1, minHeight:0 }}>

          {/* ══════════════ LEFT COLUMN ══════════════ */}
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>

            {/* Metric Cards */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"auto auto", gap:9 }}>
              {[
                { label:"Total Sleep Time",       val:"6",  unit:"Hrs",  pct:"30%", iconAsset:totalSleepIcon },
                { label:"Sleep Efficiency",       val:"45", unit:"Mins", pct:"30%", iconAsset:efficiencyIcon },
                { label:"Wake After Sleep Onset", val:"75", unit:"%",    pct:"15%", iconAsset:wasoIcon, big:true },
                { label:"Sleep Latency",          val:"20", unit:"Mins", pct:"15%", iconAsset:latencyIcon },
              ].map(({ label, val, unit, pct, iconAsset, big }) => (
                <GCard key={label} p="12px 16px">
                  {/* Title */}
                  <span style={{ fontSize:14, color:W, fontWeight:700, marginBottom:10, display:"block" }}>{label}</span>
                  {/* Body: icon | big number+unit | gap | pct+arrow */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    {/* Icon - bigger */}
                    <img src={iconAsset} alt={label} style={{ width:58, height:58, objectFit:"contain", flexShrink:0 }} />
                    {/* Big number */}
                    <div style={{ flex:1, display:"flex", alignItems:"baseline", justifyContent:"center", gap:6 }}>
                      <span style={{ fontSize:big?54:62, fontWeight:700, color:W, lineHeight:1 }}>{val}</span>
                      <span style={{ fontSize:14, color:W, opacity:0.75 }}>{unit}</span>
                    </div>
                    {/* Pct stacked above arrow with visible gap between them */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, flexShrink:0 }}>
                      <span style={{ fontSize:20, color:W, fontWeight:700, lineHeight:1 }}>{pct}</span>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6 C18 6 10 6 8 12 C6 18 4 18 4 18" stroke="#ff4444" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
                        <path d="M8 14 L4 18 L8 22" stroke="#ff4444" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                    </div>
                  </div>
                </GCard>
              ))}
            </div>

            {/* Sleep Stages + Body Movement */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
              <GCard p="11px 10px">
                <p style={{ margin:"0 0 4px", fontSize:14, color:W, fontWeight:700 }}>Sleep Stages Distribution</p>

                {/* Donut: startAngle=90 CCW → Deep=top-left quarter, REM=top-right quarter, Light=bottom half */}
                <div style={{ position:"relative", height:200 }}>

                  {/* Donut — centred, big enough to leave label space on sides */}
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={stagesData} cx="50%" cy="48%"
                           innerRadius={58} outerRadius={78}
                           startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                        {stagesData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Bottom glow */}
                  <div style={{ position:"absolute", top:"58%", left:"50%", transform:"translateX(-50%)",
                                width:"50%", height:20, pointerEvents:"none",
                                background:"radial-gradient(ellipse, rgba(21,120,190,0.6) 0%, transparent 70%)",
                                filter:"blur(6px)" }}/>

                  {/* ── Deep Sleep — left, aligned to top-left arc (≈ top 25%) ── */}
                  <div style={{
                    position:"absolute", left:2, top:"14%",
                    display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2,
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ width:9, height:9, borderRadius:"50%", flexShrink:0,
                                     background:"#0c1e38", border:"2px solid #2090d0", display:"inline-block" }}/>
                      <span style={{ fontSize:11, color:"#ffffff", fontWeight:700, whiteSpace:"nowrap" }}>Deep Sleep</span>
                    </div>
                    <span style={{ fontSize:15, color:"#ffffff", fontWeight:700, paddingLeft:14 }}>25%</span>
                  </div>

                  {/* ── REM Sleep — right, aligned to top-right arc (≈ top 25%) ── */}
                  <div style={{
                    position:"absolute", right:2, top:"14%",
                    display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2,
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ fontSize:11, color:"#ffffff", fontWeight:700, whiteSpace:"nowrap" }}>REM Sleep</span>
                      <span style={{ width:9, height:9, borderRadius:"50%", flexShrink:0,
                                     background:"#22a8d4", border:"2px solid #22a8d4", display:"inline-block" }}/>
                    </div>
                    <span style={{ fontSize:15, color:"#ffffff", fontWeight:700, paddingRight:14 }}>25%</span>
                  </div>

                  {/* ── Light Sleep — bottom centre, below the bottom arc ── */}
                    <div style={{
                      position:"absolute",
                      bottom:-18,   // moved downward
                      left:"50%",
                      transform:"translateX(-50%)",
                      display:"flex",
                      flexDirection:"column",
                      alignItems:"center",
                      gap:2,
                    }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ width:9, height:9, borderRadius:"50%", flexShrink:0,
                                     background:"#1578be", border:"2px solid #1578be", display:"inline-block" }}/>
                      <span style={{ fontSize:11, color:"#ffffff", fontWeight:700, whiteSpace:"nowrap" }}>Light Sleep</span>
                    </div>
                    <span style={{ fontSize:15, color:"#ffffff", fontWeight:700 }}>50%</span>
                  </div>

                </div>

                <p style={{ margin:"22px 0 0", textAlign:"center", fontSize:12, color:"#ffffff", fontWeight:1000 }}>
                  Total sleep time of 8 hours (480 minutes)
                </p>
              </GCard>

              <GCard p="11px 12px">
                <p style={{ margin:"0 0 4px", fontSize:14, color:W, fontWeight:700 }}>Body Movement Analysis</p>
                <div style={{ display:"flex", gap:10, marginBottom:5, flexWrap:"wrap" }}>
                  {[["#00aaff","No Movement"],["#44cc44","Moderate Movement"],["#ff3333","High Movement"]].map(([c,l])=>(
                    <span key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:W }}>
                      <span style={{ width:9, height:9, background:c, borderRadius:2, display:"inline-block" }}/>
                      {l}
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex", gap:6, height:168 }}>
                  <div style={{ width:8, borderRadius:3, flexShrink:0,
                                background:"linear-gradient(to bottom,#ff3333 0%,#44cc44 50%,#00aaff 100%)" }}/>
                  <ResponsiveContainer width="100%" height={168}>
                    <BarChart data={movementRaw} barCategoryGap="18%" margin={{ bottom:0, top:2 }}>
                      <XAxis dataKey="t" tick={{ fill:"#ffffff", fontSize:11 }} axisLine={false} tickLine={false}/>
                      <YAxis hide/>
                      <Bar dataKey="h" radius={[2,2,0,0]} shape={<MovBar/>}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GCard>
            </div>

            {/* ══════════ INSIGHTS + RECOMMENDATIONS ══════════ */}
            <GCard p="0px" style={{ flex:1 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1px 1fr", flex:1, minHeight:0, height:"100%" }}>

                {/* LEFT: Insights */}
                <div style={{ display:"flex", flexDirection:"column", padding:"14px 16px" }}>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                    <p style={{ margin:"0 0 10px", fontSize:14, color:W, fontWeight:700 }}>Insights</p>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <span style={{ fontSize:13, color:W, fontWeight:500 }}>Sleep Quality Score</span>
                      <span style={{ fontSize:14, color:W, fontWeight:700 }}>60%</span>
                    </div>
                    <div style={{ height:4, background:"rgba(255,255,255,0.1)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:"60%", height:"100%", borderRadius:2, background:"linear-gradient(90deg,#1578be,#22a8d4)" }}/>
                    </div>
                  </div>
                  <div style={{ height:1, background:"rgba(255,255,255,0.09)" }}/>
                  <div style={{ flex:1, display:"flex", alignItems:"center" }}>
                    <div style={{ display:"flex", gap:12, width:"100%" }}>
                      <span style={{ fontSize:13, color:W, opacity:0.6, flexShrink:0, width:100, fontWeight:500 }}>Recent Alerts</span>
                      <span style={{ fontSize:13, color:W, lineHeight:1.7 }}>
                        Low Sleep Efficiency<br/>Detected on February<br/>10, 2025
                      </span>
                    </div>
                  </div>
                  <div style={{ height:1, background:"rgba(255,255,255,0.09)" }}/>
                  <div style={{ flex:1, display:"flex", alignItems:"center" }}>
                    <div style={{ display:"flex", gap:12, width:"100%" }}>
                      <span style={{ fontSize:13, color:W, opacity:0.6, flexShrink:0, width:100, fontWeight:500 }}>Diagnosis</span>
                      <span style={{ fontSize:13, color:W, lineHeight:1.7 }}>
                        Insomnia: trouble falling or staying asleep, the most common sleep disorder
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vertical divider */}
                <div style={{ background:"rgba(255,255,255,0.09)" }}/>

                {/* RIGHT: Recommendations */}
                <div style={{ display:"flex", flexDirection:"column", padding:"14px 16px" }}>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                    <p style={{ margin:"0 0 12px", fontSize:14, color:W, fontWeight:700 }}>Recommendations</p>
                    {["Limit Evening Screen Time","Create a Restful Environment"].map(r=>(
                      <div key={r} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                        <div style={{ width:3, height:22, borderRadius:2, flexShrink:0, background:"rgba(255,255,255,0.5)" }}/>
                        <span style={{ fontSize:13, color:W }}>{r}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ height:1, background:"rgba(255,255,255,0.09)" }}/>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                    <p style={{ margin:"0 0 12px", fontSize:14, color:W, fontWeight:700 }}>Sleep Hygiene Tips</p>
                    {["Be Mindful of Naps","Avoid caffeine before bed"].map(t=>(
                      <div key={t} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                        <div style={{ width:3, height:22, borderRadius:2, flexShrink:0, background:"rgba(255,255,255,0.35)" }}/>
                        <span style={{ fontSize:13, color:W }}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </GCard>
          </div>

          {/* ══════════════ RIGHT COLUMN ══════════════ */}
          <div style={{ display:"flex", flexDirection:"column", gap:9, minHeight:0 }}>

            {/* Sleep Duration Over Time — 45% */}
            <GCard p="11px 13px" style={{ flex:45, minHeight:0 }}>
              <p style={{ margin:"0 0 1px", fontSize:14, color:W, fontWeight:700 }}>Sleep Duration Over Time</p>
              <p style={{ margin:"0", fontSize:12, color:W, opacity:0.9 }}>Hrs</p>
              <div style={{ position:"relative", flex:1, minHeight:0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sleepDurationData} margin={{ top:8, right:12, bottom:18, left:0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.09)" strokeDasharray="4 4" vertical={false}/>
                    <XAxis dataKey="day"
                           tick={{ fill:"#ffffff", fontSize:11, fontWeight:600 }}
                           axisLine={{ stroke:"#1a5abf", strokeWidth:2.5 }}
                           tickLine={false}
                           label={{ value:"Days", position:"insideBottomLeft", dx:-4, dy:14, fill:"#ffffff", fontSize:11, opacity:1 }}/>
                    <YAxis domain={[0,8]} ticks={[0,1,2,3,4,5,6,7,8]}
                           tick={{ fill:"#ffffff", fontSize:11 }} axisLine={false} tickLine={false} width={18}/>
                    <Line type="linear" dataKey="hours" stroke="#ffffff" strokeWidth={2}
                          dot={<LineDot/>} isAnimationActive={false}/>
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ position:"absolute", bottom:18, left:14, right:12, height:8,
                              pointerEvents:"none", background:"#1a5abf",
                              opacity:0.4, filter:"blur(5px)", borderRadius:3 }}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", paddingLeft:14, marginTop:4, flexShrink:0 }}>
                {[["good","Good Sleep"],["avg","Average Sleep"],["poor","Poor Sleep"]].map(([q,label])=>(
                  <span key={q} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:W, opacity:0.9 }}>
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8.5" stroke="white" strokeWidth="1.5"/>
                      <circle cx="7"  cy="8"  r="1.2" fill="white"/>
                      <circle cx="13" cy="8"  r="1.2" fill="white"/>
                      {q==="good" && <path d="M6 12 Q10 16 14 12" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
                      {q==="avg"  && <line x1="6" y1="13" x2="14" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>}
                      {q==="poor" && <path d="M6 14 Q10 11 14 14" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </GCard>

            {/* Wake Episodes — 55% */}
            <GCard p="10px 13px" style={{ flex:55, minHeight:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                            marginBottom:5, flexShrink:0 }}>
                <p style={{ margin:0, fontSize:14, color:W, fontWeight:700 }}>Wake Episodes</p>
                <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                  <div style={{ display:"flex", gap:8, paddingRight:2 }}>
                    <span style={{ fontSize:12, color:W, opacity:1, minWidth:70, textAlign:"center" }}>Time</span>
                    <span style={{ fontSize:12, color:W, opacity:1, minWidth:48, textAlign:"center" }}>Duration</span>
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
                <div style={{ flex:1, display:"flex", flexDirection:"column",
                              justifyContent:"space-evenly", minHeight:0 }}>
                  {wakeEpisodes.map(({ label, dur }, idx) => (
                    <div key={idx} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ width:36, fontSize:11, color:W, opacity:1, flexShrink:0, textAlign:"right" }}>
                        {label}
                      </span>
                      <div style={{ flex:1, height:12, position:"relative", display:"flex", alignItems:"center" }}>
                        {dur > 0 ? (
                          <>
                            <div style={{
                              width:`${(dur/60)*100}%`, height:"100%",
                              background:"#ffffff", borderRadius:"0 3px 3px 0", minWidth:18,
                            }}/>
                            <div style={{
                              position:"absolute",
                              left:`calc(${(dur/60)*100}% + 3px)`,
                              top:"50%", transform:"translateY(-50%)",
                              display:"flex", flexDirection:"column", alignItems:"center",
                            }}>
                              <svg width="9" height="9" viewBox="0 0 16 16" fill="none"
                                   stroke="white" strokeWidth="1.5" strokeLinecap="round">
                                <circle cx="8" cy="8" r="6.5"/>
                                <path d="M8 4.5v3.5l2.5 1.5"/>
                              </svg>
                              <img src={wakeIcon} alt="Wake" style={{
                                width:34, height:34, objectFit:"contain",
                                filter:"brightness(0) invert(1)"
                              }} />
                            </div>
                          </>
                        ) : (
                          <div style={{ width:"100%", height:1, background:"rgba(255,255,255,0.07)" }}/>
                        )}
                      </div>
                      <div style={{ width:130, flexShrink:0 }}/>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between",
                              paddingLeft:36, paddingRight:130, marginTop:4, flexShrink:0 }}>
                  {["0Min","10Min","20Min","30Min","40Min","50Min","60Min"].map(l=>(
                    <span key={l} style={{ fontSize:11, color:"#ffffff", opacity:1, fontWeight:600 }}>{l}</span>
                  ))}
                </div>
              </div>
            </GCard>

          </div>
        </div>
      </main>
    </div>
  );
}