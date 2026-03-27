import { useState, useEffect, useCallback } from "react";
import useWindowSize from "../hooks/useWindowSize";
import apiService from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const W = "#ffffff";

/* ═══════════════════════ RESIDENT DETAILS PAGE ═══════════════════════ */
export default function ResidentDetailsPage({ residentId, onBack, onNavigateToScreen }) {
  const { isMobile } = useWindowSize();
  
  const [resident, setResident] = useState(null);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [highlights, setHighlights] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadResidentDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch resident details (this is the critical one)
      const residentData = await apiService.getResidentDetails(residentId);
      setResident(residentData);
      
      // Fetch emergency contacts - don't let this fail the whole page
      try {
        const contacts = await apiService.getEmergencyContacts(residentId);
        setEmergencyContacts(contacts || []);
      } catch (contactErr) {
        console.warn('Could not load emergency contacts:', contactErr);
        setEmergencyContacts([]);
      }
      
      // Fetch assigned caregivers - don't let this fail the whole page
      try {
        const caregiversData = await apiService.getResidentCaregivers(residentId, 7);
        setCaregivers(caregiversData?.caregivers || []);
      } catch (cgErr) {
        console.warn('Could not load caregivers:', cgErr);
        setCaregivers([]);
      }
      
      // Fetch highlights - don't let this fail the whole page
      try {
        const highlightsData = await apiService.getResidentHighlights(residentId);
        setHighlights(highlightsData || {});
      } catch (highlightErr) {
        console.warn('Could not load highlights:', highlightErr);
        setHighlights({});
      }
      
    } catch (err) {
      console.error('Failed to load resident details:', err);
      setError(err);
    } finally {
            setLoading(false);
    }
  }, [residentId]);

  useEffect(() => {
    loadResidentDetails();
  }, [loadResidentDetails]);

  if (loading) {
    return (
      <main style={{ 
        flex: 1, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        paddingTop: 120, 
        minHeight: "100vh",
        background: "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
      }}>
        <LoadingSpinner message="Loading resident details..." />
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ 
        flex: 1, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        paddingTop: 120, 
        minHeight: "100vh",
        background: "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
      }}>
        <ErrorMessage error={error} onRetry={loadResidentDetails} />
      </main>
    );
  }

  const gap = isMobile ? 12 : 16;
  const cardPadding = isMobile ? "16px 18px" : "20px 24px";

  return (
    <main style={{
      flex: 1,
      padding: isMobile ? "12px" : "16px 60px",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap,
      minWidth: 0,
      fontFamily: "'Segoe UI', sans-serif",
      color: W,
      background: "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
      paddingTop: isMobile ? 80 : 100,
      paddingBottom: 20,
      minHeight: "100vh",
      boxSizing: "border-box",
    }}>
      
      {/* ═══ BACK BUTTON & HEADER ═══ */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 8,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "rgba(4,37,88,0.9)",
            border: "2px solid #FFFFFF",
            borderRadius: 12,
            padding: "12px 20px",
            color: W,
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(4,37,88,1)";
            e.currentTarget.style.transform = "translateX(-4px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(4,37,88,0.9)";
            e.currentTarget.style.transform = "translateX(0)";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Seniors
        </button>
        
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? 24 : 32,
          fontWeight: 700,
          color: "#042558",
        }}>
          Resident Details
        </h1>
      </div>

      {/* ═══ PROFILE SECTION (Photo + Details) ═══ */}
      <div style={{
        background: "#042558",
        border: "2px solid #FFFFFF",
        borderRadius: 20,
        padding: cardPadding,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 16 : 32,
        alignItems: isMobile ? "center" : "flex-start",
      }}>
        {/* Profile Photo */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}>
          <div style={{
            width: isMobile ? 140 : 180,
            height: isMobile ? 140 : 180,
            borderRadius: "50%",
            border: "3px solid #FFFFFF",
            background: "#D9D9D9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}>
            {resident?.profile_photo ? (
              <img 
                src={resident.profile_photo} 
                alt={resident.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                onError={(e) => {
                  // If S3 image fails to load, hide it and show fallback
                  e.target.style.display = 'none';
                  e.target.parentNode.querySelector('svg') && (e.target.parentNode.querySelector('svg').style.display = 'block');
                }}
              />
            ) : (
              <svg width={isMobile ? 80 : 100} height={isMobile ? 80 : 100} viewBox="0 0 24 24" fill="none" stroke="#042558" strokeWidth="1.5">
                <circle cx="12" cy="8" r="5"/>
                <path d="M3 21v-2a4 4 0 014-4h10a4 4 0 014 4v2"/>
              </svg>
            )}
          </div>
          <div style={{
            background: getStatusColor(resident?.status),
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 700,
            color: W,
            textTransform: "uppercase",
          }}>
            {resident?.status || "ACTIVE"}
          </div>
        </div>

        {/* Resident Details */}
        <div style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap: isMobile ? 12 : 16,
          width: "100%",
        }}>
          <DetailField label="Name" value={resident?.name || "N/A"} />
          <DetailField label="MRN" value={resident?.mrn || "N/A"} />
          <DetailField label="Room" value={resident?.room_id || "N/A"} />
          <DetailField label="Age" value={`${resident?.age || "N/A"} years`} />
          <DetailField label="Gender" value={resident?.sex || "N/A"} />
          <DetailField label="Admission Date" value={formatDate(resident?.admission_date)} />
          <DetailField label="Fall Risk Level" value={resident?.fall_risk_level || "MODERATE"} valueColor={getRiskColor(resident?.fall_risk_level)} />
          <DetailField label="Sleep Quality" value={resident?.latest_sleep_quality || "AVERAGE"} valueColor={getQualityColor(resident?.latest_sleep_quality)} />
        </div>
      </div>

      {/* ═══ EMERGENCY CONTACTS SECTION ═══ */}
      <div style={{
        background: "#042558",
        border: "2px solid #FFFFFF",
        borderRadius: 20,
        padding: cardPadding,
      }}>
        <h2 style={{
          margin: "0 0 16px 0",
          fontSize: isMobile ? 20 : 24,
          fontWeight: 700,
          color: W,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
          </svg>
          Emergency Contacts
        </h2>
        
        {emergencyContacts.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>No emergency contacts available</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {emergencyContacts.map((contact, idx) => (
              <EmergencyContactCard key={idx} contact={contact} isMobile={isMobile} />
            ))}
          </div>
        )}
      </div>

      {/* ═══ ASSIGNED CAREGIVERS SECTION ═══ */}
      <div style={{
        background: "#042558",
        border: "2px solid #FFFFFF",
        borderRadius: 20,
        padding: cardPadding,
      }}>
        <h2 style={{
          margin: "0 0 16px 0",
          fontSize: isMobile ? 20 : 24,
          fontWeight: 700,
          color: W,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
          Current Caregivers
        </h2>
        
        {caregivers.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>No caregivers currently assigned</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {caregivers.map((caregiver, idx) => (
              <CaregiverAssignmentCard key={idx} caregiver={caregiver} isMobile={isMobile} />
            ))}
          </div>
        )}
      </div>

      {/* ═══ HIGHLIGHTS SECTION ═══ */}
      <div style={{
        background: "#042558",
        border: "2px solid #FFFFFF",
        borderRadius: 20,
        padding: cardPadding,
      }}>
        <h2 style={{
          margin: "0 0 16px 0",
          fontSize: isMobile ? 20 : 24,
          fontWeight: 700,
          color: W,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          Recent Activity Highlights
        </h2>
        
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap: 16,
        }}>
          <HighlightCard 
            title="Last Sleep Session"
            value={highlights?.last_sleep_hours ? `${highlights.last_sleep_hours} hrs` : "N/A"}
            subtitle={highlights?.last_sleep_date ? formatDate(highlights.last_sleep_date) : ""}
            icon="sleep"
            onClick={() => onNavigateToScreen && onNavigateToScreen('Sleep Diary', residentId)}
          />
                    <HighlightCard 
            title="Recent Falls"
            value={highlights?.recent_falls_count != null ? String(highlights.recent_falls_count) : "N/A"}
            subtitle="Last 30 days"
            icon="fall"
            onClick={() => onNavigateToScreen && onNavigateToScreen('Falls', residentId)}
          />
          <HighlightCard 
            title="Gait Score"
            value={highlights?.gait_score ? `${highlights.gait_score}%` : "N/A"}
            subtitle="Balance & Mobility"
            icon="gait"
            onClick={() => onNavigateToScreen && onNavigateToScreen('Gait', residentId)}
          />
                    <HighlightCard 
            title="ADL Completion"
            value={highlights?.adl_completion ? `${highlights.adl_completion}%` : "N/A"}
            subtitle="Daily activities"
            icon="adl"
            onClick={() => onNavigateToScreen && onNavigateToScreen('ADLs', residentId)}
          />
        </div>
      </div>
    </main>
  );
}

/* ═══════════════════════ DETAIL FIELD COMPONENT ═══════════════════════ */
function DetailField({ label, value, valueColor }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: "rgba(255,255,255,0.6)",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 16,
        fontWeight: 600,
        color: valueColor || W,
      }}>
        {value}
      </span>
    </div>
  );
}

/* ═══════════════════════ EMERGENCY CONTACT CARD ═══════════════════════ */
function EmergencyContactCard({ contact, isMobile }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.1)",
      border: "1.5px solid rgba(255,255,255,0.3)",
      borderRadius: 12,
      padding: isMobile ? "12px" : "16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{
          fontSize: 16,
          fontWeight: 700,
          color: W,
        }}>
          {contact.contact_name || contact.contact_name_enc || "Unknown"}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: W,
          background: getPriorityColor(contact.contact_priority),
          padding: "4px 10px",
          borderRadius: 8,
          textTransform: "uppercase",
        }}>
          {contact.contact_priority || "N/A"}
        </span>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
          <strong>Relationship:</strong> {contact.relationship || "N/A"}
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
          <strong>Phone:</strong> {contact.phone || contact.phone_enc || "N/A"}
        </div>
        {(contact.email || contact.email_enc) && (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
            <strong>Email:</strong> {contact.email || contact.email_enc}
          </div>
        )}
      </div>
      
      {(contact.notify_on_fall || contact.is_legal_guardian) && (
        <div style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 4,
        }}>
          {contact.notify_on_fall && (
            <span style={{
              fontSize: 11,
              padding: "4px 8px",
              background: "rgba(255,107,107,0.3)",
              border: "1px solid rgba(255,107,107,0.5)",
              borderRadius: 6,
              color: W,
            }}>
              🚨 Fall Notifications
            </span>
          )}
          {contact.is_legal_guardian && (
            <span style={{
              fontSize: 11,
              padding: "4px 8px",
              background: "rgba(74,144,226,0.3)",
              border: "1px solid rgba(74,144,226,0.5)",
              borderRadius: 6,
              color: W,
            }}>
              👤 Legal Guardian
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ HIGHLIGHT CARD ═══════════════════════ */
function HighlightCard({ title, value, subtitle, icon, onClick }) {
  const getIcon = () => {
    switch(icon) {
      case "sleep":
        return <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>;
      case "fall":
        return <path d="M12 2v20M17 7l-5-5-5 5M17 17l-5 5-5-5"/>;
      case "gait":
        return <><circle cx="12" cy="8" r="3"/><path d="M12 11v9m0-9l-3 3m3-3l3 3"/></>;
      case "adl":
        return <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>;
      default:
        return <circle cx="12" cy="12" r="10"/>;
    }
  };

  return (
    <button
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1.5px solid rgba(255,255,255,0.25)",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        position: "relative",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.background = "rgba(255,255,255,0.12)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: "rgba(74,144,226,0.3)",
        border: "1.5px solid rgba(74,144,226,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2">
          {getIcon()}
        </svg>
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
          marginBottom: 4,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 24,
          fontWeight: 700,
          color: W,
          marginBottom: 2,
        }}>
          {value}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
          }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Arrow Icon */}
      {onClick && (
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#042558" strokeWidth="3" strokeLinecap="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      )}
    </button>
  );
}

/* ═══════════════════════ CAREGIVER ASSIGNMENT CARD ═══════════════════════ */
function CaregiverAssignmentCard({ caregiver, isMobile }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.1)",
      border: "1.5px solid rgba(255,255,255,0.3)",
      borderRadius: 12,
      padding: isMobile ? "14px" : "16px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      transition: "all 0.2s",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(255,255,255,0.15)";
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "rgba(255,255,255,0.1)";
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}
    >
      {/* Header with Name and Status */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flex: 1,
          minWidth: 0,
        }}>
          {/* Profile Icon */}
          <div style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#D9D9D9",
            border: "2px solid #FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#042558" strokeWidth="2">
              <circle cx="12" cy="8" r="4"/>
              <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
            </svg>
          </div>
          
          {/* Name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              color: W,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {caregiver.display_name?.split(",")[0] || caregiver.first_name + " " + caregiver.last_name || "Unknown"}
            </div>
            <div style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
              marginTop: 2,
            }}>
              {caregiver.badge_id || "N/A"}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: W,
          background: caregiver.status === "ACTIVE" ? "#6ADD00" : "#FFA500",
          padding: "4px 8px",
          borderRadius: 6,
          textTransform: "uppercase",
          flexShrink: 0,
        }}>
          {caregiver.status || "ACTIVE"}
        </span>
      </div>
      
      {/* Details Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        paddingTop: 8,
        borderTop: "1px solid rgba(255,255,255,0.2)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.6)",
            fontWeight: 600,
            textTransform: "uppercase",
          }}>
            Role
          </span>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: W,
          }}>
            {caregiver.role || "N/A"}
          </span>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.6)",
            fontWeight: 600,
            textTransform: "uppercase",
          }}>
            Shift
          </span>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: W,
          }}>
            {caregiver.shift_type || caregiver.primary_shift || "N/A"}
          </span>
        </div>
      </div>

      {/* Assignment Info */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 8,
        borderTop: "1px solid rgba(255,255,255,0.2)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6ADD00" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <path d="M22 4L12 14.01l-3-3"/>
          </svg>
          <span style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.8)",
            fontWeight: 600,
          }}>
            {caregiver.assignment_type || "PRIMARY"}
          </span>
        </div>
        
        {caregiver.assigned_date && caregiver.assigned_date !== 'N/A' && (
          <span style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.6)",
          }}>
            Assigned: {formatDate(caregiver.assigned_date)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ HELPER FUNCTIONS ═══════════════════════ */
function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function getStatusColor(status) {
  switch(status?.toUpperCase()) {
    case "ACTIVE": return "#6ADD00";
    case "DISCHARGED": return "#FFA500";
    case "DECEASED": return "#666666";
    default: return "#4A90E2";
  }
}

function getRiskColor(level) {
  switch(level?.toUpperCase()) {
    case "HIGH": return "#FF6B6B";
    case "MODERATE": return "#FFA500";
    case "LOW": return "#6ADD00";
    default: return "#4A90E2";
  }
}

function getQualityColor(quality) {
  switch(quality?.toUpperCase()) {
    case "GOOD": return "#6ADD00";
    case "AVERAGE": return "#FFA500";
    case "POOR": return "#FF6B6B";
    default: return "#4A90E2";
  }
}

function getPriorityColor(priority) {
  switch(priority?.toUpperCase()) {
    case "PRIMARY": return "#FF6B6B";
    case "SECONDARY": return "#FFA500";
    case "TERTIARY": return "#4A90E2";
    default: return "#666666";
  }
}
