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
  { name:"REM Sleep",   value:sleepData.sleepStages.remSleep,   color:"#22a8d4" },
  { name:"Light Sleep", value:sleepData.sleepStages.lightSleep, color:"#1578be" },
  { name:"Deep Sleep",  value:sleepData.sleepStages.deepSleep,  color:"#0a2240" },
];

const totalSleepHours = Math.floor(sleepData.sleepStages.totalMinutes / 60);
const totalSleepMins  = sleepData.sleepStages.totalMinutes;

const metricCards = [
  { label:"Total Sleep Time",       val:String(sleepData.metrics.totalSleepTime.value),       unit:sleepData.metrics.totalSleepTime.unit,       pct:`${sleepData.metrics.totalSleepTime.change}%`,       icon:totalSleepIcon },
  { label:"Sleep Efficiency",       val:String(sleepData.metrics.sleepEfficiency.value),      unit:sleepData.metrics.sleepEfficiency.unit,      pct:`${sleepData.metrics.sleepEfficiency.change}%`,      icon:efficiencyIcon },
  { label:"Wake After Sleep Onset", val:String(sleepData.metrics.wakeAfterSleepOnset.value),  unit:sleepData.metrics.wakeAfterSleepOnset.unit,  pct:`${sleepData.metrics.wakeAfterSleepOnset.change}%`,  icon:wasoIcon, big:true },
  { label:"Sleep Latency",          val:String(sleepData.metrics.sleepLatency.value),         unit:sleepData.metrics.sleepLatency.unit,         pct:`${sleepData.metrics.sleepLatency.change}%`,         icon:latencyIcon },
];

/* ═══════════════════════ HELPERS ════════════════════════════════════════ */
const W = "#ffffff";

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

const GCard = ({ children, style = {}, p = "13px 15px" }) => (
  <div style={{
    position:"relative", borderRadius:11,
    background:"#0c1825", border:"1px solid #192e47",
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

  // Responsive values
  const padding       = isMobile ? "10px 10px" : "13px 15px";
  const gap           = isMobile ? 8 : 9;
  const twoCol        = isDesktop;  // two-column main grid only on desktop
  const metricBigNum  = isMobile ? 38 : 62;
  const metricBigNumB = isMobile ? 32 : 54;

  return (
    <main style={{
      flex: 1,
      padding: padding,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: gap,
      minWidth: 0,
      /* on mobile push content below the hamburger button */
      paddingTop: isMobile ? 60 : (isTablet ? 13 : 13),
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <div style={{
          background:"rgba(6,12,22,0.8)", border:"2px solid #ffffff",
          borderRadius:10, padding:"5px 12px",
          display:"flex", alignItems:"center", gap:6,
          fontSize:12, color:W, cursor:"pointer", fontWeight:500,
        }}>
          {date}
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{
          background:"#177080", borderRadius:10, padding:"5px 12px",
          display:"flex", alignItems:"center", gap:6,
          fontSize:12, color:W, cursor:"pointer", fontWeight:500,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
                    {sleepData.patient.name}
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr",
        gap: gap,
        flex: 1,
        minHeight: 0,
      }}>

        {/* ══════════ LEFT COLUMN ══════════ */}
        <div style={{ display:"flex", flexDirection:"column", gap:gap }}>

          {/* Metric Cards — always 2-col grid */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:gap }}>
            {metricCards.map(({ label, val, unit, pct, icon, big }) => (
              <GCard key={label} p={isMobile ? "10px 10px" : "12px 16px"}>
                <span style={{ fontSize:isMobile?11:14, color:W, fontWeight:700, marginBottom:8, display:"block" }}>{label}</span>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <img src={icon} alt={label} style={{ width:isMobile?36:58, height:isMobile?36:58, objectFit:"contain", flexShrink:0 }}/>
                  <div style={{ flex:1, display:"flex", alignItems:"baseline", justifyContent:"center", gap:4 }}>
                    <span style={{ fontSize:big?metricBigNumB:metricBigNum, fontWeight:700, color:W, lineHeight:1 }}>{val}</span>
                    <span style={{ fontSize:isMobile?11:14, color:W, opacity:0.75 }}>{unit}</span>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flexShrink:0 }}>
                    <span style={{ fontSize:isMobile?14:20, color:W, fontWeight:700, lineHeight:1 }}>{pct}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6 C18 6 10 6 8 12 C6 18 4 18 4 18" stroke="#ff4444" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
                      <path d="M8 14 L4 18 L8 22" stroke="#ff4444" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </div>
                </div>
              </GCard>
            ))}
          </div>

          {/* Sleep Stages + Body Movement — 2-col on tablet+, stack on mobile */}
          <div style={{
            display:"grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap:gap,
          }}>

            {/* Sleep Stages Distribution */}
            <GCard p="11px 10px">
              <p style={{ margin:"0 0 8px", fontSize:14, color:W, fontWeight:700 }}>Sleep Stages Distribution</p>

              {/* Row: [Deep label] | [Donut] | [REM label] */}
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>

                {/* Left — Deep Sleep label */}
                <div style={{ width:72, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-start", gap:3 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:9, height:9, borderRadius:"50%", flexShrink:0,
                                   background:"#0c1e38", border:"2px solid #2090d0", display:"inline-block" }}/>
                    <span style={{ fontSize:10, color:W, fontWeight:700, lineHeight:1.3 }}>Deep<br/>Sleep</span>
                  </div>
                                    <span style={{ fontSize:15, color:W, fontWeight:700, paddingLeft:14 }}>{sleepData.sleepStages.deepSleep}%</span>
                </div>

                {/* Centre — donut only, no absolute labels inside */}
                <div style={{ flex:1, position:"relative" }}>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie data={stagesData} cx="50%" cy="50%"
                           innerRadius={52} outerRadius={70}
                           startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                        {stagesData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* bottom glow */}
                  <div style={{ position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)",
                                width:"50%", height:16, pointerEvents:"none",
                                background:"radial-gradient(ellipse, rgba(21,120,190,0.55) 0%, transparent 70%)",
                                filter:"blur(5px)" }}/>
                </div>

                {/* Right — REM Sleep label */}
                <div style={{ width:72, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ fontSize:10, color:W, fontWeight:700, lineHeight:1.3, textAlign:"right" }}>REM<br/>Sleep</span>
                    <span style={{ width:9, height:9, borderRadius:"50%", flexShrink:0,
                                   background:"#22a8d4", border:"2px solid #22a8d4", display:"inline-block" }}/>
                  </div>
                                    <span style={{ fontSize:15, color:W, fontWeight:700, paddingRight:14 }}>{sleepData.sleepStages.remSleep}%</span>
                </div>
              </div>

              {/* Light Sleep below the donut */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, marginTop:4 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:9, height:9, borderRadius:"50%", flexShrink:0,
                                 background:"#1578be", border:"2px solid #1578be", display:"inline-block" }}/>
                  <span style={{ fontSize:11, color:W, fontWeight:700 }}>Light Sleep</span>
                </div>
                <span style={{ fontSize:15, color:W, fontWeight:700 }}>{sleepData.sleepStages.lightSleep}%</span>
              </div>

              <p style={{ margin:"6px 0 0", textAlign:"center", fontSize:9, color:W, opacity:0.5 }}>
                Total sleep time of {totalSleepHours} hours ({totalSleepMins} minutes)
              </p>
            </GCard>

            {/* Body Movement */}
            <GCard p="11px 12px">
              <p style={{ margin:"0 0 4px", fontSize:14, color:W, fontWeight:700 }}>Body Movement Analysis</p>
              <div style={{ display:"flex", gap:8, marginBottom:5, flexWrap:"wrap" }}>
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
                    <XAxis dataKey="t" tick={{ fill:"#ffffff", fontSize:isMobile?8:11 }} axisLine={false} tickLine={false}/>
                    <YAxis hide/>
                    <Bar dataKey="h" radius={[2,2,0,0]} shape={<MovBar/>}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GCard>
          </div>

          {/* Insights + Recommendations */}
          <GCard p="0px" style={{ flex: twoCol ? 1 : "unset" }}>
            <div style={{
              display:"grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1px 1fr",
              flex:1, minHeight:0, height:"100%",
            }}>
              {/* LEFT: Insights */}
              <div style={{ display:"flex", flexDirection:"column", padding:"14px 16px" }}>
                <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                  <p style={{ margin:"0 0 10px", fontSize:14, color:W, fontWeight:700 }}>Insights</p>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <span style={{ fontSize:13, color:W, fontWeight:500 }}>Sleep Quality Score</span>
                                        <span style={{ fontSize:14, color:W, fontWeight:700 }}>{sleepData.insights.sleepQualityScore}%</span>
                  </div>
                  <div style={{ height:4, background:"rgba(255,255,255,0.1)", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ width:`${sleepData.insights.sleepQualityScore}%`, height:"100%", borderRadius:2, background:"linear-gradient(90deg,#1578be,#22a8d4)" }}/>
                  </div>
                </div>
                <div style={{ height:1, background:"rgba(255,255,255,0.09)" }}/>
                <div style={{ flex:1, display:"flex", alignItems:"center", paddingTop:8, paddingBottom:8 }}>
                  <div style={{ display:"flex", gap:12, width:"100%" }}>
                    <span style={{ fontSize:13, color:W, opacity:0.6, flexShrink:0, width:100, fontWeight:500 }}>Recent Alerts</span>
                                        <span style={{ fontSize:13, color:W, lineHeight:1.7 }}>
                      {sleepData.insights.recentAlerts}
                    </span>
                  </div>
                </div>
                <div style={{ height:1, background:"rgba(255,255,255,0.09)" }}/>
                <div style={{ flex:1, display:"flex", alignItems:"center", paddingTop:8, paddingBottom:8 }}>
                  <div style={{ display:"flex", gap:12, width:"100%" }}>
                    <span style={{ fontSize:13, color:W, opacity:0.6, flexShrink:0, width:100, fontWeight:500 }}>Diagnosis</span>
                                        <span style={{ fontSize:13, color:W, lineHeight:1.7 }}>
                      {sleepData.insights.diagnosis}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vertical divider — hidden on mobile */}
              {!isMobile && <div style={{ background:"rgba(255,255,255,0.09)" }}/>}
              {isMobile  && <div style={{ height:1, background:"rgba(255,255,255,0.09)", margin:"0 16px" }}/>}

              {/* RIGHT: Recommendations */}
              <div style={{ display:"flex", flexDirection:"column", padding:"14px 16px" }}>
                <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                  <p style={{ margin:"0 0 12px", fontSize:14, color:W, fontWeight:700 }}>Recommendations</p>
                  {sleepData.recommendations.map(r=>(
                    <div key={r} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                      <div style={{ width:3, height:22, borderRadius:2, flexShrink:0, background:"rgba(255,255,255,0.5)" }}/>
                      <span style={{ fontSize:13, color:W }}>{r}</span>
                    </div>
                  ))}
                </div>
                <div style={{ height:1, background:"rgba(255,255,255,0.09)" }}/>
                <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                  <p style={{ margin:"0 0 12px", fontSize:14, color:W, fontWeight:700 }}>Sleep Hygiene Tips</p>
                  {sleepData.sleepHygieneTips.map(t=>(
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

        {/* ══════════ RIGHT COLUMN ══════════ */}
        <div style={{ display:"flex", flexDirection:"column", gap:gap, minHeight:0 }}>

          {/* Sleep Duration */}
          <GCard p="11px 13px" style={{ flex: twoCol ? 45 : "unset", minHeight: twoCol ? 0 : 280 }}>
            <p style={{ margin:"0 0 1px", fontSize:14, color:W, fontWeight:700 }}>Sleep Duration Over Time</p>
            <p style={{ margin:"0", fontSize:12, color:W, opacity:0.9 }}>Hrs</p>
            <div style={{ position:"relative", flex:1, minHeight:0, height: twoCol ? "100%" : 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sleepDurationData} margin={{ top:8, right:12, bottom:18, left:0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.09)" strokeDasharray="4 4" vertical={false}/>
                  <XAxis dataKey="day"
                         tick={{ fill:"#ffffff", fontSize:11, fontWeight:600 }}
                         axisLine={{ stroke:"#ffffff", strokeWidth:1.5 }}
                         tickLine={false}
                         label={{ value:"Days", position:"insideBottomLeft", dx:-4, dy:14, fill:"#ffffff", fontSize:11 }}/>
                  <YAxis domain={[0,8]} ticks={[0,1,2,3,4,5,6,7,8]}
                         tick={{ fill:"#ffffff", fontSize:11 }} axisLine={{ stroke:"#ffffff", strokeWidth:1.5 }} tickLine={false} width={18}/>
                  <Line type="linear" dataKey="hours" stroke="#ffffff" strokeWidth={2}
                        dot={<LineDot/>} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", paddingLeft:14, marginTop:4, flexShrink:0 }}>
              {[["good","Good Sleep"],["avg","Average Sleep"],["poor","Poor Sleep"]].map(([q,label])=>(
                <span key={q} style={{ display:"flex", alignItems:"center", gap:4, fontSize:isMobile?9:11, color:W, opacity:0.9 }}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8.5" stroke="white" strokeWidth="1.5"/>
                    <circle cx="7" cy="8" r="1.2" fill="white"/>
                    <circle cx="13" cy="8" r="1.2" fill="white"/>
                    {q==="good" && <path d="M6 12 Q10 16 14 12" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
                    {q==="avg"  && <line x1="6" y1="13" x2="14" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>}
                    {q==="poor" && <path d="M6 14 Q10 11 14 14" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
                  </svg>
                  {label}
                </span>
              ))}
            </div>
          </GCard>

          {/* Wake Episodes */}
          <GCard p="10px 13px" style={{ flex: twoCol ? 55 : "unset", minHeight: twoCol ? 0 : 320 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5, flexShrink:0 }}>
              <p style={{ margin:0, fontSize:14, color:W, fontWeight:700 }}>Wake Episodes</p>
              <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                <div style={{ display:"flex", gap:8, paddingRight:2 }}>
                  <span style={{ fontSize:12, color:W, minWidth:70, textAlign:"center" }}>Time</span>
                  <span style={{ fontSize:12, color:W, minWidth:48, textAlign:"center" }}>Duration</span>
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
                    <span style={{ width:36, fontSize:11, color:W, flexShrink:0, textAlign:"right" }}>{label}</span>
                    <div style={{ flex:1, height:12, position:"relative", display:"flex", alignItems:"center" }}>
                      {dur > 0 ? (
                        <>
                          <div style={{ width:`${(dur/60)*100}%`, height:"100%",
                                        background:"#ffffff", borderRadius:"0 3px 3px 0", minWidth:18 }}/>
                          <div style={{
                            position:"absolute", left:`calc(${(dur/60)*100}% + 3px)`,
                            top:"50%", transform:"translateY(-50%)",
                            display:"flex", alignItems:"center",
                          }}>
                            <img src={wakeIcon} alt="Wake" style={{
                              width:34, height:34, objectFit:"contain",
                              filter:"brightness(0) invert(1)",
                              border:"none", display:"block",
                            }}/>
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
                  <span key={l} style={{ fontSize:isMobile?9:11, color:"#ffffff", fontWeight:600 }}>{l}</span>
                ))}
              </div>
            </div>
          </GCard>
        </div>
      </div>
    </main>
  );
}