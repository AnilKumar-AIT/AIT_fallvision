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

const MOBILITY_OPTIONS = ["INDEPENDENT", "ASSISTED", "WHEELCHAIR"];
const SEX_OPTIONS = ["M", "F"];
const RISK_LEVEL_OPTIONS = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
const RISK_FACTOR_OPTIONS = [
  "diabetes",
  "neuropathy",
  "polypharmacy",
  "nocturia",
  "cognitive_impairment",
  "vision_impairment",
];

const EMPTY_CONTACT = {
  contact_name: "",
  relationship: "",
  phone: "",
  email: "",
  contact_priority: "",
  notify_on_fall: false,
  is_legal_guardian: false,
};
const PRIORITY_OPTIONS = ["PRIMARY", "SECONDARY", "TERTIARY"];
const RELATIONSHIP_OPTIONS = ["Spouse", "Son", "Daughter", "Sibling", "Friend", "Other"];

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

/* ═══════════════════════ CHECKBOX GROUP ═══════════════════════ */
function CheckboxGroup({ options, selected, onChange, isMobile }) {
  const toggle = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {options.map((opt) => {
        const isActive = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            style={{
              background: isActive
                ? "rgba(74,144,226,0.3)"
                : "rgba(255,255,255,0.05)",
              border: `1.5px solid ${
                isActive ? "rgba(74,144,226,0.7)" : BORDER
              }`,
              borderRadius: 8,
              padding: isMobile ? "6px 10px" : "8px 14px",
              fontSize: isMobile ? 11 : 13,
              fontWeight: isActive ? 700 : 400,
              color: W,
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {isActive && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke={GREEN}
                strokeWidth="3"
                style={{ marginRight: 6, verticalAlign: "middle" }}
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
            {opt.replace(/_/g, " ")}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */
export default function AddSeniorPage({ onBack, onSeniorAdded }) {
  const { isMobile } = useWindowSize();

  // Form state — everything starts empty, user fills what they have
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [bedId, setBedId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [mobilityClass, setMobilityClass] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [mrn, setMrn] = useState("");
  const [fallRiskLevel, setFallRiskLevel] = useState("");
  const [riskFactors, setRiskFactors] = useState([]);
  const [sleepMonitoringConsent, setSleepMonitoringConsent] = useState(false);
  const [videoClipConsent, setVideoClipConsent] = useState(false);
  const [sleepQuality, setSleepQuality] = useState("");

  // Emergency contacts — start with one blank row
  const [emergencyContacts, setEmergencyContacts] = useState([{ ...EMPTY_CONTACT }]);

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
    if (!age || parseInt(age) < 60 || parseInt(age) > 120)
      return "Age must be between 60 and 120";
    if (!sex) return "Sex is required";
    if (!roomNumber.trim()) return "Room number is required";
    if (!mobilityClass) return "Mobility class is required";
    if (!photoFile) return "Photo is required for resident identification";
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
      // Only send what the user actually filled in — backend uses N/A for the rest
      const residentData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        age: parseInt(age),
        sex: sex || "",
        height_cm: heightCm ? parseInt(heightCm) : "",
        weight_kg: weightKg ? parseFloat(weightKg) : "",
        room_number: roomNumber.trim(),
        bed_id: bedId || "",
        unit_id: unitId || "",
        mobility_class: mobilityClass || "",
        admission_date: admissionDate || "",
        mrn: mrn.trim() || "",
        fall_risk_level: fallRiskLevel || "",
        risk_factors: riskFactors,
        sleep_monitoring_consent: sleepMonitoringConsent,
        video_clip_consent: videoClipConsent,
        latest_sleep_quality: sleepQuality || "",
        // Only include contacts that have at least a name
        emergency_contacts: emergencyContacts
          .filter((c) => c.contact_name.trim())
          .map((c) => ({
            contact_name: c.contact_name.trim(),
            relationship: c.relationship || "N/A",
            phone: c.phone.trim() || "N/A",
            email: c.email.trim() || "N/A",
            contact_priority: c.contact_priority || "N/A",
            notify_on_fall: c.notify_on_fall,
            is_legal_guardian: c.is_legal_guardian,
          })),
      };

      const result = await apiService.createResident(residentData, photoFile);
      console.log("Resident created:", result);
      setSuccess(true);

      // Notify parent after short delay so user sees success
      setTimeout(() => {
        if (onSeniorAdded) onSeniorAdded(result.resident);
        if (onBack) onBack();
      }, 1500);
    } catch (err) {
      console.error("Failed to create resident:", err);
      setError(err.message || "Failed to create resident. Please try again.");
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
          Add New Senior
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
              Senior Added Successfully!
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.7 }}>
              Redirecting back to seniors list...
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
            x
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
                Resident Photo{" "}
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
                Upload a clear, recent photo of the resident for identification
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
                  placeholder="e.g. James"
                />
              </FormField>
              <FormField label="Last Name" required isMobile={isMobile}>
                <TextInput
                  value={lastName}
                  onChange={setLastName}
                  placeholder="e.g. Smith"
                />
              </FormField>
              <FormField label="Age" required isMobile={isMobile}>
                <TextInput
                  value={age}
                  onChange={setAge}
                  placeholder="e.g. 78"
                  type="number"
                  min="60"
                  max="120"
                />
              </FormField>
              <FormField label="Sex" required isMobile={isMobile}>
                <SelectInput
                  value={sex}
                  onChange={setSex}
                  options={SEX_OPTIONS}
                  placeholder="Select sex"
                />
              </FormField>
              <FormField label="Height (cm)" isMobile={isMobile}>
                <TextInput
                  value={heightCm}
                  onChange={setHeightCm}
                  placeholder="e.g. 172"
                  type="number"
                  min="100"
                  max="220"
                />
              </FormField>
              <FormField label="Weight (kg)" isMobile={isMobile}>
                <TextInput
                  value={weightKg}
                  onChange={setWeightKg}
                  placeholder="e.g. 72.5"
                  type="number"
                  step="0.1"
                  min="30"
                  max="200"
                />
              </FormField>
              <FormField label="MRN (Medical Record Number)" isMobile={isMobile}>
                <TextInput
                  value={mrn}
                  onChange={setMrn}
                  placeholder="Auto-generated if empty"
                />
              </FormField>
            </div>
          </div>

          {/* ── Room & Unit ── */}
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
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9,22 9,12 15,12 15,22" />
              </svg>
              Room & Unit Assignment
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                gap: 16,
              }}
            >
              <FormField label="Room Number" required isMobile={isMobile}>
                <TextInput
                  value={roomNumber}
                  onChange={setRoomNumber}
                  placeholder="e.g. 201"
                />
              </FormField>
              <FormField label="Bed ID" isMobile={isMobile}>
                <SelectInput
                  value={bedId}
                  onChange={setBedId}
                  options={["A", "B", "C"]}
                  placeholder="Select bed"
                />
              </FormField>
              <FormField label="Unit" isMobile={isMobile}>
                <SelectInput
                  value={unitId}
                  onChange={setUnitId}
                  options={[
                    "UNIT#u-2-north",
                    "UNIT#u-2-south",
                    "UNIT#u-3-north",
                    "UNIT#u-3-south",
                  ]}
                  placeholder="Select unit"
                />
              </FormField>
              <FormField label="Admission Date" isMobile={isMobile}>
                <TextInput
                  value={admissionDate}
                  onChange={setAdmissionDate}
                  type="date"
                />
              </FormField>
            </div>
          </div>

          {/* ── Clinical Information ── */}
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
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Clinical Information
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                gap: 16,
              }}
            >
              <FormField label="Mobility Class" required isMobile={isMobile}>
                <SelectInput
                  value={mobilityClass}
                  onChange={setMobilityClass}
                  options={MOBILITY_OPTIONS}
                  placeholder="Select mobility level"
                />
              </FormField>
              <FormField label="Fall Risk Level" isMobile={isMobile}>
                <SelectInput
                  value={fallRiskLevel}
                  onChange={setFallRiskLevel}
                  options={RISK_LEVEL_OPTIONS}
                  placeholder="Select risk level"
                />
              </FormField>
              <FormField label="Sleep Quality" isMobile={isMobile}>
                <SelectInput
                  value={sleepQuality}
                  onChange={setSleepQuality}
                  options={["GOOD", "AVERAGE", "POOR"]}
                  placeholder="Select sleep quality"
                />
              </FormField>
            </div>

            <div style={{ marginTop: 16 }}>
              <FormField label="Risk Factors" isMobile={isMobile}>
                <CheckboxGroup
                  options={RISK_FACTOR_OPTIONS}
                  selected={riskFactors}
                  onChange={setRiskFactors}
                  isMobile={isMobile}
                />
              </FormField>
            </div>
          </div>

          {/* ── Emergency Contacts ── */}
          <div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 16,
            }}>
              <h3 style={{
                margin: 0, fontSize: 16, fontWeight: 700, color: ACCENT,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={ACCENT} strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                </svg>
                Emergency Contacts
              </h3>
              <button
                type="button"
                onClick={() => setEmergencyContacts([...emergencyContacts, { ...EMPTY_CONTACT }])}
                style={{
                  background: "rgba(74,144,226,0.2)", border: `1.5px solid ${ACCENT}`,
                  borderRadius: 8, padding: "6px 14px", fontSize: 13,
                  fontWeight: 600, color: ACCENT, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={ACCENT} strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add Contact
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {emergencyContacts.map((contact, idx) => {
                const update = (field, val) => {
                  const copy = [...emergencyContacts];
                  copy[idx] = { ...copy[idx], [field]: val };
                  setEmergencyContacts(copy);
                };
                return (
                  <div key={idx} style={{
                    background: "rgba(255,255,255,0.05)",
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 14, padding: isMobile ? 14 : 20,
                    display: "flex", flexDirection: "column", gap: 14,
                    position: "relative",
                  }}>
                    {/* Contact # badge + remove */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
                        Contact #{idx + 1}
                      </span>
                      {emergencyContacts.length > 1 && (
                        <button type="button" onClick={() =>
                          setEmergencyContacts(emergencyContacts.filter((_, i) => i !== idx))
                        } style={{
                          background: "rgba(255,107,107,0.15)",
                          border: "1px solid rgba(255,107,107,0.4)",
                          borderRadius: 6, padding: "4px 10px",
                          fontSize: 11, color: "#FF6B6B", cursor: "pointer",
                        }}>Remove</button>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
                      <FormField label="Full Name" isMobile={isMobile}>
                        <TextInput value={contact.contact_name}
                          onChange={(v) => update("contact_name", v)}
                          placeholder="e.g. John Doe" />
                      </FormField>
                      <FormField label="Relationship" isMobile={isMobile}>
                        <SelectInput value={contact.relationship}
                          onChange={(v) => update("relationship", v)}
                          options={RELATIONSHIP_OPTIONS}
                          placeholder="Select relationship" />
                      </FormField>
                      <FormField label="Phone" isMobile={isMobile}>
                        <TextInput value={contact.phone}
                          onChange={(v) => update("phone", v)}
                          placeholder="e.g. (555) 123-4567" />
                      </FormField>
                      <FormField label="Email" isMobile={isMobile}>
                        <TextInput value={contact.email}
                          onChange={(v) => update("email", v)}
                          placeholder="e.g. john@email.com" type="email" />
                      </FormField>
                      <FormField label="Priority" isMobile={isMobile}>
                        <SelectInput value={contact.contact_priority}
                          onChange={(v) => update("contact_priority", v)}
                          options={PRIORITY_OPTIONS}
                          placeholder="Select priority" />
                      </FormField>
                    </div>

                    {/* Toggles row */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <label style={{
                        display: "flex", alignItems: "center", gap: 8,
                        cursor: "pointer", fontSize: 13, color: W,
                      }}>
                        <div onClick={() => update("notify_on_fall", !contact.notify_on_fall)}
                          style={{
                            width: 36, height: 20, borderRadius: 10,
                            background: contact.notify_on_fall ? GREEN : "rgba(255,255,255,0.2)",
                            position: "relative", cursor: "pointer", flexShrink: 0,
                          }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: "50%",
                            background: W, position: "absolute", top: 3,
                            left: contact.notify_on_fall ? 19 : 3,
                            transition: "left 0.2s",
                          }}/>
                        </div>
                        Notify on Fall
                      </label>
                      <label style={{
                        display: "flex", alignItems: "center", gap: 8,
                        cursor: "pointer", fontSize: 13, color: W,
                      }}>
                        <div onClick={() => update("is_legal_guardian", !contact.is_legal_guardian)}
                          style={{
                            width: 36, height: 20, borderRadius: 10,
                            background: contact.is_legal_guardian ? GREEN : "rgba(255,255,255,0.2)",
                            position: "relative", cursor: "pointer", flexShrink: 0,
                          }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: "50%",
                            background: W, position: "absolute", top: 3,
                            left: contact.is_legal_guardian ? 19 : 3,
                            transition: "left 0.2s",
                          }}/>
                        </div>
                        Legal Guardian
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Consent & Monitoring ── */}
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
              Consent & Monitoring
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Sleep monitoring consent toggle */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  padding: "10px 16px",
                  background: sleepMonitoringConsent
                    ? "rgba(106,221,0,0.1)"
                    : INPUT_BG,
                  border: `1.5px solid ${
                    sleepMonitoringConsent
                      ? "rgba(106,221,0,0.4)"
                      : BORDER
                  }`,
                  borderRadius: 10,
                  transition: "all 0.2s",
                }}
              >
                <div
                  onClick={() =>
                    setSleepMonitoringConsent(!sleepMonitoringConsent)
                  }
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: sleepMonitoringConsent ? GREEN : "rgba(255,255,255,0.2)",
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
                      left: sleepMonitoringConsent ? 23 : 3,
                      transition: "left 0.2s",
                    }}
                  />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: W }}>
                  Sleep Monitoring Consent
                </span>
              </label>

              {/* Video clip consent toggle */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  padding: "10px 16px",
                  background: videoClipConsent
                    ? "rgba(106,221,0,0.1)"
                    : INPUT_BG,
                  border: `1.5px solid ${
                    videoClipConsent
                      ? "rgba(106,221,0,0.4)"
                      : BORDER
                  }`,
                  borderRadius: 10,
                  transition: "all 0.2s",
                }}
              >
                <div
                  onClick={() => setVideoClipConsent(!videoClipConsent)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: videoClipConsent ? GREEN : "rgba(255,255,255,0.2)",
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
                      left: videoClipConsent ? 23 : 3,
                      transition: "left 0.2s",
                    }}
                  />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: W }}>
                  Video Clip Consent (Fall Recording)
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
                  Adding Senior...
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
                  Add Senior
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
