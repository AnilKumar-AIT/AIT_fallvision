import { useState }   from "react";
import Sidebar        from "../components/Sidebar";
import SleepDiaryPage from "./SleepDiaryPage";

/*
 * ─── ADD NEW PAGES HERE ──────────────────────────────────────────────────
 *  1. Create  src/pages/FallsPage.jsx
 *  2. import FallsPage from "./FallsPage";
 *  3. Add to PAGE_MAP:  "Falls": <FallsPage />
 * ─────────────────────────────────────────────────────────────────────────
 */
const PAGE_MAP = {
  "Sleep Diary": <SleepDiaryPage />,
  // "Home":        <HomePage />,
  // "Falls":       <FallsPage />,
  // "ADLs":        <ADLsPage />,
  // "Gait":        <GaitPage />,
  // "Seniors":     <SeniorsPage />,
  // "Caregivers":  <CaregiversPage />,
};

const ComingSoon = ({ name }) => (
  <main style={{
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 16,
    background: "#060c16",
  }}>
    <div style={{
      width: 64, height: 64, borderRadius: 16,
      background: "rgba(26,120,200,0.15)",
      border: "1px solid rgba(26,120,200,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
           stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <path d="M9 9h6M9 12h6M9 15h4"/>
      </svg>
    </div>
    <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#ffffff" }}>{name}</p>
    <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
      This page is coming soon
    </p>
  </main>
);

export default function Dashboard() {
  const [activePage, setActivePage] = useState("Sleep Diary");
  const CurrentPage = PAGE_MAP[activePage] ?? <ComingSoon name={activePage} />;

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: "#060c16",
      fontFamily: "'Segoe UI', sans-serif",
      color: "#ffffff",
      overflow: "hidden",
    }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      {CurrentPage}
    </div>
  );
}