import { useState, useEffect } from "react";
import useWindowSize from "../hooks/useWindowSize";
import usersData from "../data/users.json";
import aitLogo   from "../assets/ait.svg";

/* ═══════════════════════ PALETTE ═════════════════════════════════════════
   White & Yellow clinical aesthetic derived from the AIT brand.
   ══════════════════════════════════════════════════════════════════════ */
const C = {
  bg:           "#f5f5f5",
  cardBg:       "#ffffff",
  primary:      "#f0b429",          // warm yellow (from logo)
  primaryHover: "#d99e1e",
  primaryText:  "#1a1a1a",          // dark text on yellow buttons
  text:         "#1f2937",
  textSoft:     "#6b7280",
  border:       "#e5e7eb",
  error:        "#dc2626",
  errorBg:      "rgba(220,38,38,0.08)",
  focusRing:    "rgba(240,180,41,0.35)",
  inputBg:      "#fafafa",
};

/* ═══════════════════════ STYLES ═════════════════════════════════════════ */
const wrap = {
  display: "flex", alignItems: "center", justifyContent: "center",
  minHeight: "100vh", width: "100%",
  background: `linear-gradient(160deg, ${C.bg} 0%, #eaeaea 100%)`,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  padding: 20,
};

const card = {
  width: "100%", maxWidth: 420,
  background: C.cardBg,
  borderRadius: 18,
  boxShadow: "0 8px 40px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
  padding: "40px 36px 36px",
  display: "flex", flexDirection: "column", alignItems: "center",
};

const logoStyle = {
  width: 90, height: 90, objectFit: "contain", marginBottom: 8,
};

const heading = {
  fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 4px", textAlign: "center",
};

const subHeading = {
  fontSize: 13, color: C.textSoft, margin: "0 0 28px", textAlign: "center",
};

const labelStyle = {
  display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6,
};

const inputWrap = {
  position: "relative", width: "100%", marginBottom: 18,
};

const baseInput = {
  width: "100%", height: 46, borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.inputBg,
  padding: "0 42px 0 14",
  fontSize: 14, color: C.text,
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const btnPrimary = {
  width: "100%", height: 48, borderRadius: 10, border: "none",
  background: C.primary,
  color: C.primaryText,
  fontSize: 15, fontWeight: 700,
  cursor: "pointer",
  transition: "background 0.2s, transform 0.1s",
  marginTop: 6,
  letterSpacing: 0.3,
};

/* ═══════════════════════ ICONS (inline SVGs) ════════════════════════════ */
const EyeOpen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
       stroke={C.textSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeClosed = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
       stroke={C.textSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke={C.textSoft} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }}>
    <rect x="2" y="4" width="20" height="16" rx="3"/>
    <polyline points="22,7 12,14 2,7"/>
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke={C.textSoft} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }}>
    <rect x="3" y="11" width="18" height="11" rx="3"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

/* ═══════════════════════ VALIDATORS ═════════════════════════════════════ */
function validateEmail(v) {
  if (!v.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address";
  return "";
}

function validatePassword(v) {
  if (!v) return "Password is required";
  if (v.length < 6) return "Password must be at least 6 characters";
  return "";
}

/* ═══════════════════════ COMPONENT ═════════════════════════════════════ */
export default function LoginPage({ onLogin, onForgotPassword }) {
  const { isMobile } = useWindowSize();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [emailErr, setEmailErr]     = useState("");
  const [pwErr, setPwErr]           = useState("");
  const [formErr, setFormErr]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [touched, setTouched]       = useState({ email: false, pw: false });
  const [shake, setShake]           = useState(false);

  /* live validation after first touch */
  useEffect(() => { if (touched.email) setEmailErr(validateEmail(email)); }, [email, touched.email]);
  useEffect(() => { if (touched.pw)   setPwErr(validatePassword(password)); }, [password, touched.pw]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({ email: true, pw: true });
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailErr(eErr);
    setPwErr(pErr);
    if (eErr || pErr) return;

    setLoading(true);
    setFormErr("");

    /* simulate network latency */
    setTimeout(() => {
      const user = usersData.users.find(
        u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
      );
      setLoading(false);
      if (user) {
        onLogin(user);
      } else {
        setFormErr("Invalid email or password. Please try again.");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    }, 800);
  };

  const focusBorder = `1px solid ${C.primary}`;
  const focusShadow = `0 0 0 3px ${C.focusRing}`;

  return (
    <div style={wrap}>
      <form onSubmit={handleSubmit}
            style={{
              ...card,
              padding: isMobile ? "28px 20px 24px" : "40px 36px 36px",
              maxWidth: isMobile ? "100%" : 420,
              animation: shake ? "shake 0.4s ease" : "none",
            }}>

        {/* Logo */}
        <img src={aitLogo} alt="AIT Sensors" style={{ ...logoStyle, width: isMobile ? 68 : 90, height: isMobile ? 68 : 90 }} />

        {/* Title */}
        <h1 style={{ ...heading, fontSize: isMobile ? 19 : 22 }}>Welcome Back</h1>
        <p style={subHeading}>Sign in to AIT Medical Dashboard</p>

        {/* Global error */}
        {formErr && (
          <div style={{
            width: "100%", padding: "10px 14px", borderRadius: 10,
            background: C.errorBg, color: C.error, fontSize: 13,
            fontWeight: 500, marginBottom: 16, textAlign: "center",
          }}>
            {formErr}
          </div>
        )}

        {/* Email */}
        <div style={{ width: "100%" }}>
          <label style={labelStyle}>Email Address</label>
          <div style={inputWrap}>
            <MailIcon />
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, email: true }))}
              style={{
                ...baseInput,
                paddingLeft: 40,
                borderColor: emailErr && touched.email ? C.error : C.border,
              }}
              onFocus={e => {
                e.target.style.border = focusBorder;
                e.target.style.boxShadow = focusShadow;
              }}
              onBlurCapture={e => {
                e.target.style.border = `1px solid ${emailErr ? C.error : C.border}`;
                e.target.style.boxShadow = "none";
              }}
            />
            {emailErr && touched.email && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: C.error }}>{emailErr}</p>
            )}
          </div>
        </div>

        {/* Password */}
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={labelStyle}>Password</label>
            <span
              onClick={onForgotPassword}
              style={{
                fontSize: 12, color: C.primary, fontWeight: 600,
                cursor: "pointer", marginBottom: 6, userSelect: "none",
              }}
            >
              Forgot Password?
            </span>
          </div>
          <div style={inputWrap}>
            <LockIcon />
            <input
              type={showPw ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, pw: true }))}
              style={{
                ...baseInput,
                paddingLeft: 40,
                borderColor: pwErr && touched.pw ? C.error : C.border,
              }}
              onFocus={e => {
                e.target.style.border = focusBorder;
                e.target.style.boxShadow = focusShadow;
              }}
              onBlurCapture={e => {
                e.target.style.border = `1px solid ${pwErr ? C.error : C.border}`;
                e.target.style.boxShadow = "none";
              }}
            />
            {/* Visibility toggle */}
            <button
              type="button"
              onClick={() => setShowPw(s => !s)}
              style={{
                position: "absolute", right: 10, top: "50%",
                transform: pwErr && touched.pw ? "translateY(-72%)" : "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", padding: 2,
              }}
            >
              {showPw ? <EyeOpen /> : <EyeClosed />}
            </button>
            {pwErr && touched.pw && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: C.error }}>{pwErr}</p>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            ...btnPrimary,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onMouseDown={e => { if (!loading) e.target.style.transform = "scale(0.98)"; }}
          onMouseUp={e   => { e.target.style.transform = "scale(1)"; }}
          onMouseLeave={e => { e.target.style.transform = "scale(1)"; }}
          onMouseOver={e  => { if (!loading) e.target.style.background = C.primaryHover; }}
          onMouseOut={e   => { e.target.style.background = C.primary; }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        {/* Footer */}
        <p style={{ margin: "24px 0 0", fontSize: 11, color: C.textSoft, textAlign: "center" }}>
          &copy; {new Date().getFullYear()} AIT Sensors &mdash; Medical Monitoring Platform
        </p>
      </form>

      {/* Keyframe animation for shake on error */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
