import { useState }    from "react";
import gaitIcon        from "../assets/gait.svg";
import adlIcon         from "../assets/ADL.svg";
import fallsIcon       from "../assets/falls.svg";
import homeIcon        from "../assets/home.svg";
import sleepDiaryIcon  from "../assets/sleep_diary.svg";
import seniorsIcon     from "../assets/seniors.svg";
import caregiversIcon  from "../assets/caregivers.svg";
import useWindowSize   from "../hooks/useWindowSize";

/* ── Theme definitions per page ── */
const THEMES = {
  dark: {
    navBg:        "linear-gradient(135deg, #0c1e3a 0%, #162d50 50%, #1a3a66 100%)",
    navFallback:  "#0c1e3a",
    border:       "rgba(255,255,255,0.08)",
    activeBg:     "rgba(255,255,255,0.15)",
    text:         "#ffffff",
    iconFilter:   "brightness(0) invert(1)",
    btnBg:        "rgba(255,255,255,0.12)",
    iconStroke:   "white",
    iconFill:     "white",
    hamburgerBg:  "#0c1e3a",
    hamburgerBorder: "rgba(255,255,255,0.15)",
  },
  light: {
    navBg:        "linear-gradient(135deg, #1a6ad4 0%, #2b7de0 50%, #4da4f0 100%)",
    navFallback:  "#2b7de0",
    border:       "rgba(255,255,255,0.15)",
    activeBg:     "rgba(255,255,255,0.22)",
    text:         "#ffffff",
    iconFilter:   "brightness(0) invert(1)",
    btnBg:        "rgba(255,255,255,0.15)",
    iconStroke:   "white",
    iconFill:     "white",
    hamburgerBg:  "#2b7de0",
    hamburgerBorder: "rgba(255,255,255,0.2)",
  },
};

/* Map each page to a theme — all pages use dark nav */
const PAGE_THEME = {};

function getTheme(activePage) {
  return THEMES[PAGE_THEME[activePage] || "dark"];
}

const NAV_ITEMS = [
  { label: "Home",        icon: homeIcon        },
  { label: "Falls",       icon: fallsIcon       },
  { label: "ADLs",        icon: adlIcon         },
  { label: "Sleep Diary", icon: sleepDiaryIcon  },
  { label: "Gait",        icon: gaitIcon        },
  { label: "Seniors",     icon: seniorsIcon     },
  { label: "Caregivers",  icon: caregiversIcon  },
];

export default function Sidebar({ activePage, onNavigate }) {
  const { isMobile } = useWindowSize();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = getTheme(activePage);

  /* ── Mobile: hamburger + drawer ── */
  if (isMobile) {
    return (
      <>
        {/* Hamburger button */}
        <button
          onClick={() => setMobileOpen(o => !o)}
          style={{
            position: "fixed", top: 10, left: 10, zIndex: 1100,
            width: 38, height: 38, borderRadius: 10,
            background: t.hamburgerBg, border: `1px solid ${t.hamburgerBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke={t.iconStroke} strokeWidth="2" strokeLinecap="round">
            {mobileOpen
              ? <><path d="M18 6L6 18"/><path d="M6 6l12 12"/></>
              : <><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></>
            }
          </svg>
        </button>

        {/* Backdrop */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 1050, background: "rgba(0,0,0,0.5)" }}
          />
        )}

        {/* Drawer — slides from top */}
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 1060,
          background: t.navBg,
          borderBottom: `1px solid ${t.border}`,
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 10,
          transform: mobileOpen ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 0.25s ease",
        }}>
          {/* Nav icons row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingTop: 40 }}>
            {NAV_ITEMS.map(({ label, icon }) => {
              const active = label === activePage;
              return (
                <div
                  key={label}
                  onClick={() => { onNavigate(label); setMobileOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                    background: active ? t.activeBg : "transparent",
                  }}
                >
                  <img src={icon} alt={label} style={{ width: 22, height: 22, filter: t.iconFilter, opacity: active ? 1 : 0.65 }} />
                  <span style={{ fontSize: 12, color: t.text, fontWeight: active ? 700 : 400, opacity: active ? 1 : 0.7 }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

          /* ── Desktop / Tablet: 3 content-sized pills with space between ── */
  const pillH = 52;
  const pillStyle = {
    background: "linear-gradient(180deg, #0a1a30 0%, #0e2240 40%, #112a50 100%)",
    border: "2px solid rgba(255,255,255,0.6)",
    borderRadius: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "visible",
    height: pillH, flexShrink: 0,
  };

    return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      height: 68, flexShrink: 0,
      background: "transparent",
      display: "flex", alignItems: "flex-end",
      padding: "0 20px 6px",
      gap: 14,
      pointerEvents: "none", // Allow clicks to pass through empty areas
    }}>
            {/* ── Pill 1: Nav icons ── */}
      <nav style={{ ...pillStyle, gap: 6, padding: "0 10px", pointerEvents: "auto" }}>
        {NAV_ITEMS.map(({ label, icon }) => {
          const active = label === activePage;
          return (
            <div
              key={label}
              onClick={() => onNavigate(label)}
              title={label}
              style={{
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 46, height: "100%",
                cursor: "pointer",
              }}
            >
              {active && (
                <div style={{
                  position: "absolute", top: -2, left: "50%", transform: "translateX(-50%)",
                  width: 0, height: 0,
                  borderLeft: "18px solid transparent",
                  borderRight: "18px solid transparent",
                  borderTop: "14px solid rgba(255,255,255,0.92)",
                  zIndex: 2, pointerEvents: "none",
                }} />
              )}
              <img src={icon} alt={label} style={{
                width: 30, height: 30,
                filter: t.iconFilter,
                opacity: active ? 1 : 0.5,
                position: "relative", zIndex: 1,
              }} />
            </div>
          );
        })}
      </nav>

      {/* Space between Pill 1 and Pills 2+3 */}
      <div style={{ flex: 1 }} />

            {/* ── Pill 2: Insights and Alerts ── */}
      <div style={{ ...pillStyle, gap: 10, padding: "0 20px", cursor: "pointer", pointerEvents: "auto" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4l2 2"/>
        </svg>
        <span style={{ fontSize: 14, color: "#ffffff", fontWeight: 600, whiteSpace: "nowrap" }}>Insights and Alerts</span>
      </div>

            {/* ── Pill 3: Bell + User ── */}
      <div style={{ ...pillStyle, gap: 6, padding: "0 14px", pointerEvents: "auto" }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="9" r="3"/>
            <path d="M6.2 19.4a6 6 0 0111.6 0"/>
          </svg>
        </div>
      </div>
    </header>
  );
}