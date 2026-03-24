import { useState } from "react";
import apiService from "../services/api";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const W = "#ffffff";
const CARD_BG = "#042558";
const INPUT_BG = "rgba(255,255,255,0.08)";
const BORDER = "rgba(255,255,255,0.3)";
const ACCENT = "#4A90E2";

const FALL_RISK_OPTIONS = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
const SLEEP_QUALITY_OPTIONS = ["GOOD", "AVERAGE", "POOR"];
const MOBILITY_OPTIONS = ["INDEPENDENT", "ASSISTED", "WHEELCHAIR"];
const STATUS_OPTIONS = ["ACTIVE", "DISCHARGED", "DECEASED"];

/* ═══════════════════════ FORM FIELD COMPONENTS ═══════════════════════ */
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

/* ═══════════════════════ MAIN EDIT MODAL ═══════════════════════ */
export default function EditResidentModal({ resident, onClose, onUpdate, isMobile }) {
  // Parse the resident name
  const parseNameFromDisplay = (displayName) => {
    if (!displayName) return { firstName: "", lastName: "" };
    const nameParts = displayName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    return { firstName, lastName };
  };
  
  const { firstName, lastName } = parseNameFromDisplay(resident.name);

  // Form state - initialize with existing resident data
  const [formFirstName, setFormFirstName] = useState(firstName || "");
  const [formLastName, setFormLastName] = useState(lastName || "");
  const [age, setAge] = useState(resident.age?.toString() || "");
  const [roomNumber, setRoomNumber] = useState(resident.room_id || "");
  const [mrn, setMrn] = useState(resident.mrn || "");
  const [fallRiskLevel, setFallRiskLevel] = useState(resident.fall_risk_level || "");
  const [sleepQuality, setSleepQuality] = useState(resident.latest_sleep_quality || "");
  const [mobilityClass, setMobilityClass] = useState(resident.mobility_class || "");
  const [status, setStatus] = useState(resident.status || "ACTIVE");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const validateForm = () => {
    if (!formFirstName.trim()) return "First name is required";
    if (!formLastName.trim()) return "Last name is required";
    if (!age || isNaN(age) || age < 1) return "Valid age is required";
    if (!roomNumber.trim()) return "Room number is required";
    if (!fallRiskLevel) return "Fall risk level is required";

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
      const updatedData = {
        first_name: formFirstName.trim(),
        last_name: formLastName.trim(),
        age: parseInt(age),
        room_number: roomNumber.trim(),
        mrn: mrn.trim() || undefined,
        fall_risk_level: fallRiskLevel,
        latest_sleep_quality: sleepQuality,
        mobility_class: mobilityClass,
        status: status,
      };

      const result = await apiService.updateResident(resident.resident_id, updatedData);
      console.log("Resident updated:", result);

      // Notify parent of successful update
      if (onUpdate) {
        onUpdate({
          ...resident,
          name: `${formFirstName} ${formLastName}`,
          age: parseInt(age),
          room_id: roomNumber,
          mrn: mrn,
          fall_risk_level: fallRiskLevel,
          latest_sleep_quality: sleepQuality,
          mobility_class: mobilityClass,
          status: status,
        });
      }

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      console.error("Failed to update resident:", err);
      setError(err.message || "Failed to update resident. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const gridCols = isMobile ? "1fr" : "1fr 1fr";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          zIndex: 9998,
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isMobile ? "95%" : "90%",
          maxWidth: 900,
          maxHeight: "90vh",
          background: CARD_BG,
          border: "2px solid #FFFFFF",
          borderRadius: 20,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          zIndex: 9999,
          animation: "slideIn 0.3s ease",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: isMobile ? "20px" : "24px 32px",
            borderBottom: `2px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 20 : 24,
              fontWeight: 700,
              color: W,
            }}
          >
            Edit Resident
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: W,
              cursor: "pointer",
              padding: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={W}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "20px" : "28px 32px",
          }}
        >
          {/* Error Banner */}
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
                marginBottom: 20,
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

          {/* Form Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {/* Personal Information */}
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
                    value={formFirstName}
                    onChange={setFormFirstName}
                    placeholder="e.g. John"
                  />
                </FormField>
                <FormField label="Last Name" required isMobile={isMobile}>
                  <TextInput
                    value={formLastName}
                    onChange={setFormLastName}
                    placeholder="e.g. Smith"
                  />
                </FormField>
                <FormField label="Age" required isMobile={isMobile}>
                  <TextInput
                    value={age}
                    onChange={setAge}
                    placeholder="e.g. 78"
                    type="number"
                  />
                </FormField>
                <FormField label="MRN" isMobile={isMobile}>
                  <TextInput
                    value={mrn}
                    onChange={setMrn}
                    placeholder="e.g. MRN-2025-004891"
                  />
                </FormField>
              </div>
            </div>

            {/* Facility Details */}
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
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Facility & Health Information
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
                <FormField label="Mobility Class" isMobile={isMobile}>
                  <SelectInput
                    value={mobilityClass}
                    onChange={setMobilityClass}
                    options={MOBILITY_OPTIONS}
                    placeholder="Select mobility"
                  />
                </FormField>
                <FormField label="Fall Risk Level" required isMobile={isMobile}>
                  <SelectInput
                    value={fallRiskLevel}
                    onChange={setFallRiskLevel}
                    options={FALL_RISK_OPTIONS}
                    placeholder="Select risk level"
                  />
                </FormField>
                <FormField label="Sleep Quality" isMobile={isMobile}>
                  <SelectInput
                    value={sleepQuality}
                    onChange={setSleepQuality}
                    options={SLEEP_QUALITY_OPTIONS}
                    placeholder="Select quality"
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
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: isMobile ? "16px 20px" : "20px 32px",
            borderTop: `2px solid ${BORDER}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: `1.5px solid ${BORDER}`,
              borderRadius: 12,
              padding: "12px 28px",
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
                ? "rgba(74,144,226,0.3)"
                : "linear-gradient(135deg, #4A90E2, #357ABD)",
              border: "none",
              borderRadius: 12,
              padding: "12px 32px",
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
                : "0 4px 16px rgba(74,144,226,0.3)",
            }}
            onMouseEnter={(e) => {
              if (!submitting)
                e.currentTarget.style.transform = "translateY(-1px)";
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
                Updating...
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
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -48%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
