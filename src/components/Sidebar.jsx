import { useState }    from "react";
import aitLogo         from "../assets/ait.svg";
import gaitIcon        from "../assets/gait.svg";
import adlIcon         from "../assets/ADL.svg";
import fallsIcon       from "../assets/falls.svg";
import homeIcon        from "../assets/home.svg";
import sleepDiaryIcon  from "../assets/sleep_diary.svg";
import seniorsIcon     from "../assets/seniors.svg";
import caregiversIcon  from "../assets/caregivers.svg";
import useWindowSize   from "../hooks/useWindowSize";

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
  const { isMobile, isTablet } = useWindowSize();
  const [mobileOpen, setMobileOpen] = useState(false);

  // icon-only on tablet, full on desktop, drawer on mobile
  const iconOnly = isTablet;
  const sidebarWidth = isMobile ? 0 : isTablet ? 64 : 185;

  /* ── Mobile drawer overlay ── */
  if (isMobile) {
    return (
      <>
        {/* Hamburger button */}
        <button
          onClick={() => setMobileOpen(o => !o)}
          style={{
            position: "fixed", top: 12, left: 12, zIndex: 1000,
            width: 40, height: 40, borderRadius: 10,
            background: "#07101b", border: "1px solid #122030",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="white" strokeWidth="2" strokeLinecap="round">
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
            style={{
              position: "fixed", inset: 0, zIndex: 998,
              background: "rgba(0,0,0,0.6)",
            }}
          />
        )}

        {/* Drawer */}
        <aside style={{
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 999,
          width: 200,
          background: "#07101b",
          borderRight: "1px solid #122030",
          display: "flex", flexDirection: "column",
          paddingTop: 14, paddingBottom: 8,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}>
          <SidebarContent
            activePage={activePage}
            onNavigate={(page) => { onNavigate(page); setMobileOpen(false); }}
            iconOnly={false}
          />
        </aside>
      </>
    );
  }

  /* ── Desktop / Tablet sidebar ── */
  return (
    <aside style={{
      width: sidebarWidth, flexShrink: 0,
      background: "#07101b",
      borderRight: "1px solid #122030",
      display: "flex", flexDirection: "column",
      paddingTop: 14, paddingBottom: 8,
      transition: "width 0.2s ease",
    }}>
      <SidebarContent
        activePage={activePage}
        onNavigate={onNavigate}
        iconOnly={iconOnly}
      />
    </aside>
  );
}

/* ── Shared inner content ── */
function SidebarContent({ activePage, onNavigate, iconOnly }) {
  return (
    <>
      {/* Logo */}
      <div style={{
        display: "flex", justifyContent: "center",
        marginBottom: 18, padding: iconOnly ? "0 4px" : "0 10px",
      }}>
        <img src={aitLogo} alt="AIT Logo" style={{
          width: iconOnly ? 44 : 155,
          height: iconOnly ? 44 : 155,
          objectFit: "contain",
          transition: "width 0.2s, height 0.2s",
        }} />
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {NAV_ITEMS.map(({ label, icon }) => {
          const active = label === activePage;
          return (
            <div
              key={label}
              onClick={() => onNavigate(label)}
              title={iconOnly ? label : undefined}
              style={{
                display: "flex",
                flexDirection: iconOnly ? "column" : "row",
                alignItems: "center",
                justifyContent: iconOnly ? "center" : "flex-start",
                padding: iconOnly ? "10px 0" : "10px 14px",
                cursor: "pointer",
                gap: iconOnly ? 3 : 12,
                background: active ? "rgba(26,120,200,0.14)" : "transparent",
                borderLeft: active ? "3px solid #2090d0" : "3px solid transparent",
              }}
            >
              <img src={icon} alt={label} style={{
                width: 26, height: 26,
                filter: "brightness(0) invert(1)",
                opacity: active ? 1 : 0.75,
                flexShrink: 0,
              }} />
              {iconOnly
                ? <span style={{ fontSize: 9, color: "#ffffff", opacity: active ? 1 : 0.6, textAlign: "center" }}>{label}</span>
                : <span style={{ fontSize: 13, color: "#ffffff", fontWeight: active ? 600 : 400, opacity: active ? 1 : 0.75 }}>{label}</span>
              }
            </div>
          );
        })}
      </nav>

      {/* Bottom icons */}
      <div style={{
        display: "flex",
        flexDirection: iconOnly ? "column" : "row",
        gap: 6,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 10, paddingBottom: 18,
        borderTop: "1px solid rgba(255,255,255,0.07)",
        marginTop: 8,
      }}>
        <div style={{ width:30, height:30, background:"rgba(255,255,255,0.12)", borderRadius:7,
                      display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <svg width="15" height="15" viewBox="0 0 14 14" fill="white">
            <rect x="0" y="0" width="5.5" height="5.5" rx="1"/>
            <rect x="8.5" y="0" width="5.5" height="5.5" rx="1"/>
            <rect x="0" y="8.5" width="5.5" height="5.5" rx="1"/>
            <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/>
          </svg>
        </div>
        <div style={{ width:30, height:30, background:"rgba(255,255,255,0.12)", borderRadius:7,
                      display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
               stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2h4v4M14 2l-5 5M6 14H2v-4M2 14l5-5"/>
          </svg>
        </div>
        <div style={{ width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
        </div>
        <div style={{ width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="9" r="3"/>
            <path d="M6.2 19.4a6 6 0 0111.6 0"/>
          </svg>
        </div>
      </div>
    </>
  );
}