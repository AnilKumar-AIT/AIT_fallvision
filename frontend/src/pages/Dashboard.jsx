import { useState }        from "react";
import LoginPage           from "./LoginPage";
import ForgotPasswordPage  from "./ForgotPasswordPage";
import Sidebar             from "../components/Sidebar";
import SleepDiaryPage      from "./SleepDiaryPage";
import GaitPage            from "./GaitPage";

/*
 * ─── ADD NEW PAGES HERE ──────────────────────────────────────────────────
 *  1. Create  src/pages/FallsPage.jsx
 *  2. import FallsPage from "./FallsPage";
 *  3. Add to PAGE_MAP:  "Falls": <FallsPage />
 * ─────────────────────────────────────────────────────────────────────────
 */
const PAGE_MAP = {
  "Sleep Diary": <SleepDiaryPage />,
  "Gait":        <GaitPage />,
  // "Home":        <HomePage />,
  // "Falls":       <FallsPage />,
  // "ADLs":        <ADLsPage />,
  // "Seniors":     <SeniorsPage />,
  // "Caregivers":  <CaregiversPage />,
};

/* ── Background per page ── */
const PAGE_BG = {
  "Sleep Diary": "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
  "Gait":        "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
};

const ComingSoon = ({ name }) => (
  <main style={{
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 16,
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
        <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{name}</p>
    <p style={{ margin: 0, fontSize: 14, opacity: 0.35 }}>
      This page is coming soon
    </p>
  </main>
);

export default function Dashboard() {
  const [user, setUser]             = useState(null);
  const [authScreen, setAuthScreen] = useState("login"); // "login" | "forgot"
  const [activePage, setActivePage] = useState("Sleep Diary");

  /* ── Not logged in → show auth screens ── */
  if (!user) {
    if (authScreen === "forgot") {
      return <ForgotPasswordPage onBackToLogin={() => setAuthScreen("login")} />;
    }
    return (
      <LoginPage
        onLogin={(u) => setUser(u)}
        onForgotPassword={() => setAuthScreen("forgot")}
      />
    );
  }

  /* ── Logged in → show Dashboard ── */
  const CurrentPage = PAGE_MAP[activePage] ?? <ComingSoon name={activePage} />;
    const bg = PAGE_BG[activePage] || "#060c16";
  const textColor = "#ffffff";

    return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: bg,
      fontFamily: "'Segoe UI', sans-serif",
      color: textColor,
      overflow: "hidden",
      transition: "background 0.3s ease, color 0.3s ease",
      position: "relative",
    }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      {CurrentPage}
    </div>
  );
}