import { useState, useRef } from "react";
import useWindowSize from "../hooks/useWindowSize";
import apiService from "../services/api";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const W = "#ffffff";
const CARD_BG = "#042558";
const INPUT_BG = "rgba(255,255,255,0.08)";
const BORDER = "rgba(255,255,255,0.3)";
const ACCENT = "#4A90E2";
const GREEN = "#6ADD00";

const ROLE_OPTIONS = ["RN", "LPN", "CNA", "PT", "NP", "ADMIN"];
const SHIFT_OPTIONS = ["DAY", "EVENING", "NIGHT"];
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "ON_LEAVE"];

/* ═══════════════════════ STYLED INPUT COMPONENT ═══════════════════════ */
function FormField({ label, children, required, isMobile }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: isMobile ? 12 : 14,
          fontWeight: 600,
          color: W,
          opacity: 0.85,
        }}
      >
        {label} {required && <span style={{ color: "#FF6B6B" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", ...rest }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: INPUT_BG,
        border: `1.5px solid ${BORDER}`,
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 14,
        color: W,
        fontFamily: "'Segoe UI', sans-serif",
        outline: "none",
        transition: "border-color 0.2s",
        width: "100%",
        boxSizing: "border-box",
      }}
      onFocus={(e) => (e.target.style.borderColor = ACCENT)}
      onBlur={(e) => (e.target.style.borderColor = BORDER)}
      {...rest}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: INPUT_BG,
        border: `1.5px solid ${BORDER}`,
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 14,
        color: value ? W : "rgba(255,255,255,0.4)",
        fontFamily: "'Segoe UI', sans-serif",
        outline: "none",
        cursor: "pointer",
        width: "100%",
        boxSizing: "border-box",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l5 5 5-5' stroke='white' stroke-width='2' fill='none'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 16px center",
      }}
    >
      <option value="" style={{ background: "#0e2240", color: W }}>
        {placeholder || "Select..."}
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt} style={{ background: "#0e2240", color: W }}>
          {opt}
        </option>
      ))}
    </select>
  );
}

/* ═══════════════════════ PHOTO UPLOAD COMPONENT ═══════════════════════ */
function PhotoUpload({ photoPreview, onPhotoSelect, isMobile }) {
  const fileInputRef = useRef(null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Photo Preview Circle */}
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: isMobile ? 120 : 150,
          height: isMobile ? 120 : 150,
          borderRadius: "50%",
          border: `3px dashed ${photoPreview ? GREEN : BORDER}`,
          background: photoPreview
            ? "transparent"
            : "rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          overflow: "hidden",
          transition: "all 0.3s",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = ACCENT;
          e.currentTarget.style.transform = "scale(1.03)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = photoPreview ? GREEN : BORDER;
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {photoPreview ? (
          <img
            src={photoPreview}
            alt="Preview"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "50%",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke={W}
              strokeWidth="1.5"
              strokeLinecap="round"
              style={{ opacity: 0.5 }}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span
              style={{
                fontSize: 11,
                color: W,
                opacity: 0.5,
                textAlign: "center",
              }}
            >
              Click to upload
            </span>
          </div>
        )}

        {/* Hover overlay when photo exists */}
        {photoPreview && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={W}
              strokeWidth="2"
            >
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPhotoSelect(file);
        }}
        style={{ display: "none" }}
      />

      <span
        style={{
          fontSize: 12,
          color: W,
          opacity: 0.5,
          textAlign: "center",
        }}
      >
        JPG, PNG or WebP (max 5MB)
      </span>
    </div>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */
export default function AddCaregiverPage({ onBack, onCaregiverAdded }) {
  const { isMobile } = useWindowSize();

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [primaryShift, setPrimaryShift] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [fallResponseTrained, setFallResponseTrained] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [maxResidentLoad, setMaxResidentLoad] = useState("");

  // Photo state
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handlePhotoSelect = (file) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be less than 5MB");
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
    setError(null);
  };

  const validateForm = () => {
    if (!firstName.trim()) return "First name is required";
    if (!lastName.trim()) return "Last name is required";
    if (!email.trim()) return "Email is required";
    if (!role) return "Role is required";
    if (!primaryShift) return "Primary shift is required";
    if (!photoFile) return "Photo is required for caregiver identification";
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Valid email is required";
    
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const caregiverData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || "N/A",
        role: role,
        primary_shift: primaryShift,
        badge_id: badgeId.trim() || "",
        employee_id: employeeId.trim() || "",
        status: status,
        fall_response_trained: fallResponseTrained,
        mfa_enabled: mfaEnabled,
        max_resident_load: maxResidentLoad ? parseInt(maxResidentLoad) : 10,
      };

      const result = await apiService.createCaregiver(caregiverData, photoFile);
      console.log("Caregiver created:", result);
      setSuccess(true);

      // Notify parent after short delay so user sees success
      setTimeout(() => {
        if (onCaregiverAdded) onCaregiverAdded(result.caregiver);
        if (onBack) onBack();
      }, 1500);
    } catch (err) {
      console.error("Failed to create caregiver:", err);
      setError(err.message || "Failed to create caregiver. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const gridCols = isMobile ? "1fr" : "1fr 1fr";

  return (
    <main
      style={{
        flex: 1,
        padding: isMobile ? "10px 10px" : "12px 16px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
        fontFamily: "'Segoe UI', sans-serif",
        color: W,
        position: "relative",
        zIndex: 1,
        paddingTop: isMobile ? 80 : 150,
        paddingBottom: isMobile ? 10 : 30,
        marginTop: 0,
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      {/* ═══ HEADER ═══ */}
      <div
        style={{
          background: CARD_BG,
          border: "1px solid #FFFFFF",
          borderRadius: 20,
          padding: isMobile ? "16px" : "20px 28px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Back Button */}
        <button
          onClick={onBack}
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1.5px solid rgba(255,255,255,0.3)",
            borderRadius: 12,
            padding: "10px 14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: W,
            fontSize: 14,
            fontWeight: 600,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.18)";
            e.currentTarget.style.transform = "translateX(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            e.currentTarget.style.transform = "translateX(0)";
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={W}
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>

        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? 20 : 26,
            fontWeight: 700,
            flex: 1,
          }}
        >
          Add New Caregiver
        </h1>

        {/* Facility Badge */}
        <div
          style={{
            background: "rgba(74,144,226,0.2)",
            border: "1px solid rgba(74,144,226,0.4)",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: ACCENT,
            whiteSpace: "nowrap",
          }}
        >
          Facility: FAC#f-001
        </div>
      </div>

      {/* ═══ SUCCESS BANNER ═══ */}
      {success && (
        <div
          style={{
            background: "rgba(106,221,0,0.15)",
            border: `2px solid ${GREEN}`,
            borderRadius: 16,
            padding: "20px 28px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            animation: "fadeIn 0.3s ease",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke={GREEN}
            strokeWidth="2.5"
          >
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <path d="M22 4L12 14.01l-3-3" />
          </svg>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: GREEN }}>
              Caregiver Added Successfully!
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.7 }}>
              Redirecting back to caregivers list...
            </p>
          </div>
        </div>
      )}

      {/* ═══ ERROR BANNER ═══ */}
      {error && (
        <div
          style={{
            background: "rgba(255,107,107,0.12)",
            border: "1.5px solid rgba(255,107,107,0.5)",
            borderRadius: 12,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FF6B6B"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span style={{ fontSize: 14, color: "#FF6B6B", fontWeight: 500 }}>
            {error}
          </span>
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              color: "#FF6B6B",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ═══ FORM BODY ═══ */}
      {!success && (
        <div
          style={{
            background: CARD_BG,
            border: "1px solid #FFFFFF",
            borderRadius: 20,
            padding: isMobile ? "20px" : "30px",
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          {/* ── Photo Upload Section ── */}
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "center" : "flex-start",
              gap: isMobile ? 20 : 40,
              paddingBottom: 24,
              borderBottom: `1.5px solid ${BORDER}`,
            }}
          >
            <PhotoUpload
              photoPreview={photoPreview}
              onPhotoSelect={handlePhotoSelect}
              isMobile={isMobile}
            />
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: W,
                }}
              >
                Caregiver Photo{" "}
                <span style={{ color: "#FF6B6B", fontSize: 14 }}>
                  * Required
                </span>
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: W,
                  opacity: 0.6,
                  lineHeight: 1.5,
                }}
              >
                Upload a clear, recent photo of the caregiver for identification
                purposes. This photo will be used across the dashboard for quick
                visual identification.
              </p>
              {photoFile && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={GREEN}
                    strokeWidth="2"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span style={{ fontSize: 13, color: GREEN, fontWeight: 600 }}>
                    {photoFile.name}
                  </span>
                  <span style={{ fontSize: 11, opacity: 0.5 }}>
                    ({(photoFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    style={{
                      background: "rgba(255,107,107,0.2)",
                      border: "1px solid rgba(255,107,107,0.4)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 11,
                      color: "#FF6B6B",
                      cursor: "pointer",
                      marginLeft: 8,
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Personal Information ── */}
          <div>
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: 16,
                fontWeight: 700,
                color: ACCENT,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={ACCENT}
                strokeWidth="2"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
              </svg>
              Personal Information
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                gap: 16,
              }}
            >
              <FormField label="First Name" required isMobile={isMobile}>
                <TextInput
                  value={firstName}
                  onChange={setFirstName}
                  placeholder="e.g. Sarah"
                />
              </FormField>
              <FormField label="Last Name" required isMobile={isMobile}>
                <TextInput
                  value={lastName}
                  onChange={setLastName}
                  placeholder="e.g. Johnson"
                />
              </FormField>
              <FormField label="Email" required isMobile={isMobile}>
                <TextInput
                  value={email}
                  onChange={setEmail}
                  placeholder="e.g. sarah.johnson@facility.com"
                  type="email"
                />
              </FormField>
              <FormField label="Phone" isMobile={isMobile}>
                <TextInput
                  value={phone}
                  onChange={setPhone}
                  placeholder="e.g. +1-555-0123"
                  type="tel"
                />
              </FormField>
            </div>
          </div>

          {/* ── Professional Details ── */}
          <div>
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: 16,
                fontWeight: 700,
                color: ACCENT,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={ACCENT}
                strokeWidth="2"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
              </svg>
              Professional Details
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                gap: 16,
              }}
            >
              <FormField label="Role" required isMobile={isMobile}>
                <SelectInput
                  value={role}
                  onChange={setRole}
                  options={ROLE_OPTIONS}
                  placeholder="Select role"
                />
              </FormField>
              <FormField label="Primary Shift" required isMobile={isMobile}>
                <SelectInput
                  value={primaryShift}
                  onChange={setPrimaryShift}
                  options={SHIFT_OPTIONS}
                  placeholder="Select shift"
                />
              </FormField>
              <FormField label="Badge ID" isMobile={isMobile}>
                <TextInput
                  value={badgeId}
                  onChange={setBadgeId}
                  placeholder="Auto-generated if empty"
                />
              </FormField>
              <FormField label="Employee ID" isMobile={isMobile}>
                <TextInput
                  value={employeeId}
                  onChange={setEmployeeId}
                  placeholder="Auto-generated if empty"
                />
              </FormField>
              <FormField label="Max Resident Load" isMobile={isMobile}>
                <TextInput
                  value={maxResidentLoad}
                  onChange={setMaxResidentLoad}
                  placeholder="e.g. 10"
                  type="number"
                  min="1"
                  max="20"
                />
              </FormField>
              <FormField label="Status" isMobile={isMobile}>
                <SelectInput
                  value={status}
                  onChange={setStatus}
                  options={STATUS_OPTIONS}
                  placeholder="Select status"
                />
              </FormField>
            </div>
          </div>

          {/* ── Training & Security ── */}
          <div>
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: 16,
                fontWeight: 700,
                color: ACCENT,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={ACCENT}
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Training & Security
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Fall Response Training toggle */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  padding: "10px 16px",
                  background: fallResponseTrained
                    ? "rgba(106,221,0,0.1)"
                    : INPUT_BG,
                  border: `1.5px solid ${
                    fallResponseTrained
                      ? "rgba(106,221,0,0.4)"
                      : BORDER
                  }`,
                  borderRadius: 10,
                  transition: "all 0.2s",
                }}
              >
                <div
                  onClick={() =>
                    setFallResponseTrained(!fallResponseTrained)
                  }
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: fallResponseTrained ? GREEN : "rgba(255,255,255,0.2)",
                    position: "relative",
                    transition: "background 0.2s",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: W,
                      position: "absolute",
                      top: 3,
                      left: fallResponseTrained ? 23 : 3,
                      transition: "left 0.2s",
                    }}
                  />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: W }}>
                  Fall Response Trained
                </span>
              </label>

              {/* MFA Enabled toggle */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  padding: "10px 16px",
                  background: mfaEnabled
                    ? "rgba(106,221,0,0.1)"
                    : INPUT_BG,
                  border: `1.5px solid ${
                    mfaEnabled
                      ? "rgba(106,221,0,0.4)"
                      : BORDER
                  }`,
                  borderRadius: 10,
                  transition: "all 0.2s",
                }}
              >
                <div
                  onClick={() => setMfaEnabled(!mfaEnabled)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: mfaEnabled ? GREEN : "rgba(255,255,255,0.2)",
                    position: "relative",
                    transition: "background 0.2s",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: W,
                      position: "absolute",
                      top: 3,
                      left: mfaEnabled ? 23 : 3,
                      transition: "left 0.2s",
                    }}
                  />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: W }}>
                  Multi-Factor Authentication (MFA) Enabled
                </span>
              </label>
            </div>
          </div>

          {/* ── Submit Buttons ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 16,
              paddingTop: 16,
              borderTop: `1.5px solid ${BORDER}`,
            }}
          >
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: `1.5px solid ${BORDER}`,
                borderRadius: 12,
                padding: "14px 32px",
                fontSize: 15,
                fontWeight: 600,
                color: W,
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: submitting ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!submitting)
                  e.currentTarget.style.background = "rgba(255,255,255,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                background: submitting
                  ? "rgba(106,221,0,0.3)"
                  : "linear-gradient(135deg, #6ADD00, #4CAF50)",
                border: "none",
                borderRadius: 12,
                padding: "14px 40px",
                fontSize: 15,
                fontWeight: 700,
                color: submitting ? "rgba(255,255,255,0.6)" : W,
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: submitting
                  ? "none"
                  : "0 4px 16px rgba(106,221,0,0.3)",
              }}
              onMouseEnter={(e) => {
                if (!submitting) e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {submitting ? (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={W}
                    strokeWidth="2"
                    style={{
                      animation: "spin 1s linear infinite",
                    }}
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Adding Caregiver...
                </>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={W}
                    strokeWidth="2.5"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add Caregiver
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
