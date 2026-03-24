import { useState }    from "react";
import seniorsIcon     from "../assets/seniors.svg";
import adlIcon         from "../assets/ADL.svg";
import fallsIcon       from "../assets/falls.svg";
import homeIcon        from "../assets/home.svg";
import sleepDiaryIcon  from "../assets/sleep_diary.svg";
import gaitIcon        from "../assets/gait.svg";
import caregiversIcon  from "../assets/caregivers.svg";
import notificationIcon from "../assets/notification.svg";
import profileIcon     from "../assets/profile-circle.svg";
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

/* ──── Seniors Filter Button Component ──── */
function SeniorsFilterButton({ label, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: value === "All" ? "rgba(255,255,255,0.08)" : "rgba(74,144,226,0.25)",
          border: `1.5px solid ${value === "All" ? "rgba(255,255,255,0.25)" : "rgba(74,144,226,0.5)"}`,
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 600,
          color: "#ffffff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ opacity: 0.7 }}>{label}:</span>
        <span>{value}</span>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#ffffff" 
          strokeWidth="2.5"
          style={{ 
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s"
          }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "transparent",
            }}
          />
          <div style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 1001,
            background: "#0e2240",
            border: "1.5px solid rgba(255,255,255,0.3)",
            borderRadius: 8,
            padding: "6px",
            minWidth: 120,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}>
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  background: value === option ? "rgba(74,144,226,0.3)" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: value === option ? 700 : 400,
                  color: "#ffffff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (value !== option) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  if (value !== option) e.currentTarget.style.background = "transparent";
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Sidebar({ activePage, onNavigate, seniorsFilters, caregiversFilters, isNavigationLocked }) {
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
      padding: "0 60px 6px 60px",
      gap: 10,
      pointerEvents: "none", // Allow clicks to pass through empty areas
    }}>
            {/* ── Pill 1: Nav icons ── */}
      <nav style={{ ...pillStyle, gap: 6, padding: "0 10px", pointerEvents: "auto" }}>
                {NAV_ITEMS.map(({ label, icon }) => {
          const active = label === activePage;
          const isLocked = isNavigationLocked && label !== "Seniors";
          
          return (
            <div
              key={label}
              onClick={() => {
                if (!isLocked) {
                  onNavigate(label);
                }
              }}
              title={label}
              style={{
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 46, height: "100%",
                cursor: isLocked ? "not-allowed" : "pointer",
                opacity: isLocked ? 0.3 : 1,
                pointerEvents: isLocked ? "none" : "auto",
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

                                    {/* ── Pill 2: Seniors Filters OR Caregivers Filters OR Insights and Alerts ── */}
      {activePage === "Seniors" && seniorsFilters ? (
        <div style={{ ...pillStyle, gap: 10, padding: "0 16px", pointerEvents: "auto" }}>
          {/* Age Group Filter */}
          <SeniorsFilterButton
            label="Age group"
            value={seniorsFilters.selectedAgeGroup}
            options={["All", "60-70", "71-80", "81+"]}
            onChange={seniorsFilters.setSelectedAgeGroup}
          />

          {/* Sleep Quality Filter */}
          <SeniorsFilterButton
            label="Sleep quality"
            value={seniorsFilters.selectedSleepQuality}
            options={["All", "GOOD", "AVERAGE", "POOR"]}
            onChange={seniorsFilters.setSelectedSleepQuality}
          />

          {/* Risk Level Filter */}
          <SeniorsFilterButton
            label="Risk level"
            value={seniorsFilters.selectedRiskLevel}
            options={["All", "LOW", "MODERATE", "HIGH"]}
            onChange={seniorsFilters.setSelectedRiskLevel}
          />
        </div>
      ) : activePage === "Caregivers" && caregiversFilters ? (
        <div style={{ ...pillStyle, gap: 10, padding: "0 16px", pointerEvents: "auto" }}>
          {/* Role Filter */}
          <SeniorsFilterButton
            label="Role"
            value={caregiversFilters.selectedRole}
            options={["All", "RN", "LPN", "CNA", "PT", "NP", "ADMIN"]}
            onChange={caregiversFilters.setSelectedRole}
          />

          {/* Shift Filter */}
          <SeniorsFilterButton
            label="Shift"
            value={caregiversFilters.selectedShift}
            options={["All", "DAY", "EVENING", "NIGHT"]}
            onChange={caregiversFilters.setSelectedShift}
          />

          {/* Status Filter */}
          <SeniorsFilterButton
            label="Status"
            value={caregiversFilters.selectedStatus}
            options={["All", "ACTIVE", "INACTIVE", "ON_LEAVE"]}
            onChange={caregiversFilters.setSelectedStatus}
          />
        </div>
                        ) : activePage === "ADLs" ? (
        // Date display - ONLY for ADLs page
        <div style={{ ...pillStyle, gap: 8, padding: "0 20px", pointerEvents: "auto" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ fontSize: 13, color: "#ffffff", fontWeight: 600, whiteSpace: "nowrap" }}>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      ) : (
        // Insights and Alerts - for all other pages
        <div style={{ ...pillStyle, gap: 10, padding: "0 20px", cursor: "pointer", pointerEvents: "auto" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4l2 2"/>
          </svg>
                    <span style={{ fontSize: 14, color: "#ffffff", fontWeight: 600, whiteSpace: "nowrap" }}>Insights and Alerts</span>
        </div>
      )}

                        {/* ── Pill 3: Bell + User ── */}
      <div style={{ ...pillStyle, gap: 6, padding: "0 14px", pointerEvents: "auto" }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <img src={notificationIcon} alt="Notifications" style={{ width: 22, height: 22 }} />
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <img src={profileIcon} alt="Profile" style={{ width: 24, height: 24 }} />
        </div>
      </div>
    </header>
  );
}