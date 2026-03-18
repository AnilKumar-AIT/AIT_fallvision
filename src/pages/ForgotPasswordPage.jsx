import { useState, useEffect, useRef } from "react";
import useWindowSize from "../hooks/useWindowSize";
import usersData from "../data/users.json";
import aitLogo   from "../assets/ait.svg";

/* ═══════════════════════ PALETTE (same as LoginPage) ═══════════════════ */
const C = {
  bg:           "#f5f5f5",
  cardBg:       "#ffffff",
  primary:      "#f0b429",
  primaryHover: "#d99e1e",
  primaryText:  "#1a1a1a",
  text:         "#1f2937",
  textSoft:     "#6b7280",
  border:       "#e5e7eb",
  error:        "#dc2626",
  errorBg:      "rgba(220,38,38,0.08)",
  success:      "#16a34a",
  successBg:    "rgba(22,163,74,0.08)",
  focusRing:    "rgba(240,180,41,0.35)",
  inputBg:      "#fafafa",
};

/* The simulated OTP — in a real app this would be server-generated */
const SIMULATED_OTP = "123456";

/* ═══════════════════════ SHARED STYLES ═════════════════════════════════ */
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
  width: 72, height: 72, objectFit: "contain", marginBottom: 8,
};

const heading = {
  fontSize: 21, fontWeight: 700, color: C.text, margin: "0 0 4px", textAlign: "center",
};

const subHeading = {
  fontSize: 13, color: C.textSoft, margin: "0 0 24px", textAlign: "center", lineHeight: 1.5,
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
  padding: "0 14px",
  fontSize: 14, color: C.text,
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const baseInputWithIcon = { ...baseInput, paddingLeft: 40 };

const btnPrimary = {
  width: "100%", height: 48, borderRadius: 10, border: "none",
  background: C.primary,
  color: C.primaryText,
  fontSize: 15, fontWeight: 700,
  cursor: "pointer",
  transition: "background 0.2s, transform 0.1s",
  marginTop: 6, letterSpacing: 0.3,
};

const btnSecondary = {
  width: "100%", height: 44, borderRadius: 10,
  border: `1.5px solid ${C.border}`,
  background: "transparent",
  color: C.textSoft,
  fontSize: 14, fontWeight: 600,
  cursor: "pointer",
  transition: "border-color 0.2s, color 0.2s",
  marginTop: 10,
};

const focusBorder = `1px solid ${C.primary}`;
const focusShadow = `0 0 0 3px ${C.focusRing}`;

/* ═══════════════════════ ICONS ═════════════════════════════════════════ */
const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke={C.textSoft} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }}>
    <rect x="2" y="4" width="20" height="16" rx="3"/>
    <polyline points="22,7 12,14 2,7"/>
  </svg>
);

const LockIcon = ({ style: s }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke={C.textSoft} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", ...s }}>
    <rect x="3" y="11" width="18" height="11" rx="3"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

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

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke={C.textSoft} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const CheckCircleIcon = ({ size = 48, color = C.success }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);

/* ═══════════════════════ STEPPER ════════════════════════════════════════ */
const StepIndicator = ({ current, total }) => (
  <div style={{ display: "flex", gap: 8, marginBottom: 20, justifyContent: "center" }}>
    {Array.from({ length: total }, (_, i) => (
      <div key={i} style={{
        width: i + 1 === current ? 28 : 10, height: 10, borderRadius: 5,
        background: i + 1 <= current ? C.primary : C.border,
        transition: "all 0.3s ease",
      }} />
    ))}
  </div>
);

/* ═══════════════════════ HELPER ═════════════════════════════════════════ */
function applyFocus(e) {
  e.target.style.border = focusBorder;
  e.target.style.boxShadow = focusShadow;
}
function removeFocus(e, hasErr) {
  e.target.style.border = `1px solid ${hasErr ? C.error : C.border}`;
  e.target.style.boxShadow = "none";
}

/* ═══════════════════════ MAIN COMPONENT ════════════════════════════════ */
export default function ForgotPasswordPage({ onBackToLogin }) {
  const { isMobile } = useWindowSize();
  const [step, setStep]             = useState(1);     // 1=email, 2=OTP, 3=newPw, 4=success
  const [email, setEmail]           = useState("");
  const [emailErr, setEmailErr]     = useState("");
  const [otp, setOtp]               = useState(["","","","","",""]);
  const [otpErr, setOtpErr]         = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showNewPw, setShowNewPw]   = useState(false);
  const [showConfPw, setShowConfPw] = useState(false);
  const [newPwErr, setNewPwErr]     = useState("");
  const [confPwErr, setConfPwErr]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [formMsg, setFormMsg]       = useState({ type: "", text: "" });
  const [timer, setTimer]           = useState(0);
  const [targetUser, setTargetUser] = useState(null);

  const otpRefs = useRef([]);

  /* countdown timer for resend */
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  /* ── STEP 1 — Email ── */
  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) { setEmailErr("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailErr("Enter a valid email"); return; }

    setLoading(true);
    setFormMsg({ type: "", text: "" });

    setTimeout(() => {
      const user = usersData.users.find(
        u => u.email.toLowerCase() === email.trim().toLowerCase()
      );
      setLoading(false);
      if (!user) {
        setEmailErr("No account found with this email address");
        return;
      }
      setTargetUser(user);
      setTimer(60);
      setStep(2);
      setFormMsg({ type: "success", text: `Verification code sent to ${email}` });
    }, 800);
  };

  /* ── STEP 2 — OTP ── */
  const handleOtpChange = (idx, val) => {
    if (val && !/^\d$/.test(val)) return;           // only digits
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    setOtpErr("");
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKey = (idx, e) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...otp];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
    setOtp(next);
    setOtpErr("");
    const focusIdx = Math.min(pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setOtpErr("Please enter the full 6-digit code"); return; }

    setLoading(true);
    setFormMsg({ type: "", text: "" });

    setTimeout(() => {
      setLoading(false);
      if (code !== SIMULATED_OTP) {
        setOtpErr("Invalid verification code. Please try again.");
        return;
      }
      setStep(3);
    }, 600);
  };

  const handleResend = () => {
    if (timer > 0) return;
    setOtp(["","","","","",""]);
    setOtpErr("");
    setTimer(60);
    setFormMsg({ type: "success", text: "A new verification code has been sent" });
  };

  /* ── STEP 3 — New password ── */
  const handleNewPwSubmit = (e) => {
    e.preventDefault();
    let hasErr = false;

    if (!newPw) { setNewPwErr("New password is required"); hasErr = true; }
    else if (newPw.length < 6) { setNewPwErr("Password must be at least 6 characters"); hasErr = true; }
    else if (!/[A-Z]/.test(newPw)) { setNewPwErr("Include at least one uppercase letter"); hasErr = true; }
    else if (!/[0-9]/.test(newPw)) { setNewPwErr("Include at least one number"); hasErr = true; }
    else if (!/[^A-Za-z0-9]/.test(newPw)) { setNewPwErr("Include at least one special character"); hasErr = true; }
    else setNewPwErr("");

    if (!confirmPw) { setConfPwErr("Please confirm your password"); hasErr = true; }
    else if (confirmPw !== newPw) { setConfPwErr("Passwords do not match"); hasErr = true; }
    else setConfPwErr("");

    if (hasErr) return;

    setLoading(true);
    setFormMsg({ type: "", text: "" });

    setTimeout(() => {
      /* Update password in memory so login works this session */
      if (targetUser) targetUser.password = newPw;
      setLoading(false);
      setStep(4);
    }, 800);
  };

  /* ── Password strength bar ── */
  const getStrength = (pw) => {
    if (!pw) return { pct: 0, label: "", color: C.border };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { pct: 20, label: "Weak",     color: C.error };
    if (score <= 2) return { pct: 40, label: "Fair",     color: "#f97316" };
    if (score <= 3) return { pct: 60, label: "Good",     color: "#eab308" };
    if (score <= 4) return { pct: 80, label: "Strong",   color: "#22c55e" };
    return              { pct: 100, label: "Excellent", color: C.success };
  };

  const strength = getStrength(newPw);

  /* ═══════════════════════ RENDER ═════════════════════════════════════ */
  return (
    <div style={wrap}>
      <div style={{
        ...card,
        padding: isMobile ? "28px 20px 24px" : "40px 36px 36px",
        maxWidth: isMobile ? "100%" : 420,
      }}>
        <img src={aitLogo} alt="AIT Sensors" style={{ ...logoStyle, width: isMobile ? 56 : 72, height: isMobile ? 56 : 72 }} />

        {step < 4 && <StepIndicator current={step} total={3} />}

        {/* ── Message banner ── */}
        {formMsg.text && (
          <div style={{
            width: "100%", padding: "10px 14px", borderRadius: 10,
            background: formMsg.type === "success" ? C.successBg : C.errorBg,
            color: formMsg.type === "success" ? C.success : C.error,
            fontSize: 13, fontWeight: 500, marginBottom: 16, textAlign: "center",
          }}>
            {formMsg.text}
          </div>
        )}

        {/* ════════════ STEP 1: Email ════════════ */}
        {step === 1 && (
          <form onSubmit={handleEmailSubmit} style={{ width: "100%" }}>
            <h1 style={heading}>Forgot Password?</h1>
            <p style={subHeading}>
              Enter your registered email address and we'll send you a verification code to reset your password.
            </p>

            <label style={labelStyle}>Email Address</label>
            <div style={inputWrap}>
              <MailIcon />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailErr(""); }}
                style={{ ...baseInputWithIcon, borderColor: emailErr ? C.error : C.border }}
                onFocus={applyFocus}
                onBlur={e => removeFocus(e, !!emailErr)}
              />
              {emailErr && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.error }}>{emailErr}</p>}
            </div>

            <button type="submit" disabled={loading}
              style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              onMouseOver={e => { if (!loading) e.target.style.background = C.primaryHover; }}
              onMouseOut={e  => { e.target.style.background = C.primary; }}
            >
              {loading ? "Verifying..." : "Send Verification Code"}
            </button>

            <button type="button" onClick={onBackToLogin} style={btnSecondary}
              onMouseOver={e => { e.target.style.borderColor = C.primary; e.target.style.color = C.primary; }}
              onMouseOut={e  => { e.target.style.borderColor = C.border;  e.target.style.color = C.textSoft; }}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {/* ════════════ STEP 2: OTP ════════════ */}
        {step === 2 && (
          <form onSubmit={handleOtpSubmit} style={{ width: "100%" }}>
            <h1 style={heading}>Enter Verification Code</h1>
            <p style={subHeading}>
              We sent a 6-digit code to <strong>{email}</strong>.<br />
              <span style={{ fontSize: 11, color: C.textSoft }}>
                (Use <strong>123456</strong> for this demo)
              </span>
            </p>

            {/* OTP boxes */}
            <div style={{ display: "flex", gap: isMobile ? 6 : 10, justifyContent: "center", marginBottom: 8 }}
                 onPaste={handleOtpPaste}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={el => otpRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  style={{
                    width: isMobile ? 40 : 48, height: isMobile ? 46 : 54, borderRadius: 10, textAlign: "center",
                    fontSize: isMobile ? 18 : 22, fontWeight: 700, color: C.text,
                    border: `1.5px solid ${otpErr ? C.error : d ? C.primary : C.border}`,
                    background: C.inputBg, outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={e => {
                    e.target.style.border = focusBorder;
                    e.target.style.boxShadow = focusShadow;
                  }}
                  onBlur={e => {
                    e.target.style.border = `1.5px solid ${otpErr ? C.error : d ? C.primary : C.border}`;
                    e.target.style.boxShadow = "none";
                  }}
                />
              ))}
            </div>
            {otpErr && <p style={{ margin: "0 0 8px", fontSize: 12, color: C.error, textAlign: "center" }}>{otpErr}</p>}

            {/* Resend */}
            <p style={{ fontSize: 13, color: C.textSoft, textAlign: "center", margin: "6px 0 18px" }}>
              {timer > 0
                ? <>Resend code in <strong style={{ color: C.primary }}>{timer}s</strong></>
                : <span onClick={handleResend}
                    style={{ color: C.primary, fontWeight: 600, cursor: "pointer" }}>
                    Resend Code
                  </span>
              }
            </p>

            <button type="submit" disabled={loading}
              style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              onMouseOver={e => { if (!loading) e.target.style.background = C.primaryHover; }}
              onMouseOut={e  => { e.target.style.background = C.primary; }}
            >
              {loading ? "Verifying..." : "Verify Code"}
            </button>

            <button type="button" onClick={() => { setStep(1); setFormMsg({ type: "", text: "" }); }} style={btnSecondary}
              onMouseOver={e => { e.target.style.borderColor = C.primary; e.target.style.color = C.primary; }}
              onMouseOut={e  => { e.target.style.borderColor = C.border;  e.target.style.color = C.textSoft; }}
            >
              Change Email
            </button>
          </form>
        )}

        {/* ════════════ STEP 3: New Password ════════════ */}
        {step === 3 && (
          <form onSubmit={handleNewPwSubmit} style={{ width: "100%" }}>
            <h1 style={heading}>Create New Password</h1>
            <p style={subHeading}>
              Your new password must be at least 6 characters and include an uppercase letter, a number, and a special character.
            </p>

            {/* New Password */}
            <label style={labelStyle}>New Password</label>
            <div style={inputWrap}>
              <LockIcon />
              <input
                type={showNewPw ? "text" : "password"}
                placeholder="Enter new password"
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setNewPwErr(""); }}
                style={{ ...baseInputWithIcon, borderColor: newPwErr ? C.error : C.border }}
                onFocus={applyFocus}
                onBlur={e => removeFocus(e, !!newPwErr)}
              />
              <button type="button" onClick={() => setShowNewPw(s => !s)}
                style={{
                  position: "absolute", right: 10, top: "50%",
                  transform: newPwErr ? "translateY(-72%)" : "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 2,
                }}>
                {showNewPw ? <EyeOpen /> : <EyeClosed />}
              </button>
              {newPwErr && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.error }}>{newPwErr}</p>}
            </div>

            {/* Strength bar */}
            {newPw && (
              <div style={{ width: "100%", marginBottom: 18, marginTop: -10 }}>
                <div style={{ height: 5, borderRadius: 3, background: C.border, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${strength.pct}%`,
                    background: strength.color, borderRadius: 3,
                    transition: "width 0.3s, background 0.3s",
                  }} />
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: strength.color, fontWeight: 600, textAlign: "right" }}>
                  {strength.label}
                </p>
              </div>
            )}

            {/* Confirm Password */}
            <label style={labelStyle}>Confirm Password</label>
            <div style={inputWrap}>
              <ShieldIcon />
              <input
                type={showConfPw ? "text" : "password"}
                placeholder="Re-enter new password"
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setConfPwErr(""); }}
                style={{ ...baseInputWithIcon, borderColor: confPwErr ? C.error : C.border }}
                onFocus={applyFocus}
                onBlur={e => removeFocus(e, !!confPwErr)}
              />
              <button type="button" onClick={() => setShowConfPw(s => !s)}
                style={{
                  position: "absolute", right: 10, top: "50%",
                  transform: confPwErr ? "translateY(-72%)" : "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 2,
                }}>
                {showConfPw ? <EyeOpen /> : <EyeClosed />}
              </button>
              {confPwErr && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.error }}>{confPwErr}</p>}
            </div>

            <button type="submit" disabled={loading}
              style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              onMouseOver={e => { if (!loading) e.target.style.background = C.primaryHover; }}
              onMouseOut={e  => { e.target.style.background = C.primary; }}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        {/* ════════════ STEP 4: Success ════════════ */}
        {step === 4 && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <CheckCircleIcon size={56} />
            <h1 style={{ ...heading, marginTop: 12 }}>Password Reset Successful</h1>
            <p style={{ ...subHeading, marginBottom: 28 }}>
              Your password has been updated successfully.<br />
              You can now sign in with your new password.
            </p>

            <button type="button" onClick={onBackToLogin}
              style={btnPrimary}
              onMouseOver={e => { e.target.style.background = C.primaryHover; }}
              onMouseOut={e  => { e.target.style.background = C.primary; }}
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* Footer */}
        <p style={{ margin: "24px 0 0", fontSize: 11, color: C.textSoft, textAlign: "center" }}>
          &copy; {new Date().getFullYear()} AIT Sensors &mdash; Medical Monitoring Platform
        </p>
      </div>
    </div>
  );
}
