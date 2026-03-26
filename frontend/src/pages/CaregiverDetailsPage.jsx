import { useState, useEffect } from "react";
import useWindowSize from "../hooks/useWindowSize";
import apiService from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const W = "#ffffff";

/* ═══════════════════════ CAREGIVER DETAILS PAGE ═══════════════════════ */
export default function CaregiverDetailsPage({ caregiverId, onBack, onNavigateToScreen }) {
  const { isMobile } = useWindowSize();
  
  const [caregiver, setCaregiver] = useState(null);
  const [certifications, setCertifications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [performance, setPerformance] = useState({});
  const [residents, setResidents] = useState({}); // Store resident data by ID
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCaregiverDetails();
  }, [caregiverId]);

  const loadCaregiverDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      
      
      // Fetch caregiver details - THIS IS CRITICAL, if it fails, show error
      const caregiverData = await apiService.getCaregiverDetails(caregiverId);
      
      setCaregiver(caregiverData);
      
      // Fetch certifications (non-critical)
      try {
        const certsData = await apiService.getCaregiverCertifications(caregiverId);
        setCertifications(certsData?.certifications || []);
        
            } catch (err) {
        setCertifications([]);
      }
      
      // Fetch assignments (non-critical)
      try {
        const assignmentsData = await apiService.getCaregiverAssignments(caregiverId);
        setAssignments(assignmentsData?.assignments || []);
        
            } catch (err) {
        setAssignments([]);
      }
      
      // Fetch all residents to map IDs to names (non-critical)
      try {
        const residentsData = await apiService.getAllResidents();
        if (residentsData && residentsData.residents) {
          const residentsMap = {};
          residentsData.residents.forEach(r => {
            // Extract name from status_name_sort field
            let displayName = 'Unknown Resident';
            if (r.status_name_sort) {
              const parts = r.status_name_sort.split('#');
              if (parts.length >= 3) {
                const lastName = parts[1] || '';
                const firstName = parts[2] || '';
                displayName = `${firstName} ${lastName}`.trim();
              }
            }
            residentsMap[r.resident_id] = {
              name: displayName,
              room_id: (r.room_id || '').replace('ROOM#r-', '') || 'N/A'
            };
                    });
          setResidents(residentsMap);
        }
            } catch (err) {
        setResidents({});
      }
      
      // Fetch schedule (non-critical)
      try {
        const scheduleData = await apiService.getCaregiverSchedule(caregiverId);
        setSchedule(scheduleData?.schedule || []);
        
            } catch (err) {
        setSchedule([]);
      }
      
      // Fetch performance (non-critical) - DON'T fail if this returns 404
      try {
        const perfData = await apiService.getCaregiverPerformance(caregiverId);
        setPerformance(perfData || {});
        
            } catch (err) {
        // Set empty performance object - this is not an error
        setPerformance({
          message: 'Performance data not available yet'
        });
      }
      
        } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

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
        <LoadingSpinner message="Loading caregiver details..." />
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
        <ErrorMessage error={error} onRetry={loadCaregiverDetails} />
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
          Back to Caregivers
        </button>
        
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? 24 : 32,
          fontWeight: 700,
          color: "#042558",
        }}>
          Caregiver Details
        </h1>
      </div>

      {/* ═══ PROFILE SECTION ═══ */}
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
            {caregiver?.profile_photo ? (
              <img 
                src={caregiver.profile_photo} 
                alt={caregiver.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
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
            background: getStatusColor(caregiver?.status),
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 700,
            color: W,
            textTransform: "uppercase",
          }}>
            {caregiver?.status || "ACTIVE"}
          </div>
        </div>

        {/* Caregiver Details */}
        <div style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap: isMobile ? 12 : 16,
          width: "100%",
        }}>
          <DetailField label="Name" value={caregiver?.name || "N/A"} />
          <DetailField label="Role" value={caregiver?.role || "N/A"} valueColor={getRoleColor(caregiver?.role)} />
          <DetailField label="Badge ID" value={caregiver?.badge_id?.replace('BADGE#', '') || "N/A"} />
          <DetailField label="Employee ID" value={caregiver?.employee_id?.replace('EMP#', '') || "N/A"} />
          <DetailField label="Primary Shift" value={caregiver?.primary_shift || "N/A"} valueColor={getShiftColor(caregiver?.primary_shift)} />
          <DetailField label="Email" value={caregiver?.email || "N/A"} />
          <DetailField label="Phone" value={caregiver?.phone || "N/A"} />
          <DetailField label="Created" value={formatDate(caregiver?.created_at)} />
        </div>
      </div>

      {/* ═══ CERTIFICATIONS SECTION ═══ */}
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
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Certifications & Licenses
        </h2>
        
        {certifications.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>No certifications on record</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {certifications.map((cert, idx) => (
              <CertificationCard key={idx} certification={cert} isMobile={isMobile} />
            ))}
          </div>
        )}
      </div>

      {/* ═══ RECENT ASSIGNMENTS SECTION ═══ */}
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
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
          Recent Resident Assignments
        </h2>
        
        {assignments.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>No recent assignments</p>
        ) : (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            {assignments.slice(0, 5).map((assignment, idx) => (
              <AssignmentCard 
                key={idx} 
                assignment={assignment} 
                residents={residents}
                isMobile={isMobile}
                onResidentClick={(residentId) => {
                  // Navigate to resident details page
                  if (onNavigateToScreen) {
                    onNavigateToScreen('resident-details', residentId);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══ PERFORMANCE HIGHLIGHTS ═══ */}
      {Object.keys(performance).length > 0 && !performance.message && (
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
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            Performance Metrics
          </h2>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: 16,
          }}>
            <MetricCard 
              title="Falls Responded"
              value={performance?.falls_responded || "N/A"}
              subtitle={performance?.falls_responded ? "Total incidents" : "Not available"}
              icon="falls"
            />
            <MetricCard 
              title="Response Time"
              value={performance?.avg_response_time_sec ? `${Math.round(performance.avg_response_time_sec)} sec` : "N/A"}
              subtitle={performance?.avg_response_time_sec ? "Average response" : "Not available"}
              icon="time"
            />
            <MetricCard 
              title="Alerts Acknowledged"
              value={performance?.alerts_acknowledged || "N/A"}
              subtitle={performance?.alerts_missed ? `${performance.alerts_missed} missed` : "Not available"}
              icon="alerts"
            />
            <MetricCard 
              title="Residents Served"
              value={performance?.residents_served || "N/A"}
              subtitle={performance?.shifts_worked ? `${performance.shifts_worked} shifts` : "Not available"}
              icon="residents"
            />
          </div>
        </div>
      )}
      
      {/* Show message if performance data is not available */}
      {performance?.message && (
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
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            Performance Metrics
          </h2>
          <div style={{
            textAlign: "center",
            padding: "40px 20px",
            opacity: 0.7,
          }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="1.5" style={{ margin: "0 auto 16px" }}>
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            <p style={{ margin: 0, fontSize: 16 }}>{performance.message}</p>
          </div>
        </div>
      )}
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

/* ═══════════════════════ CERTIFICATION CARD ═══════════════════════ */
function CertificationCard({ certification, isMobile }) {
  const isExpiringSoon = certification.days_until_expiry && certification.days_until_expiry < 30;
  const isExpired = certification.cert_status === 'EXPIRED';
  
  return (
    <div style={{
      background: "rgba(255,255,255,0.1)",
      border: `1.5px solid ${isExpired ? 'rgba(255,107,107,0.5)' : isExpiringSoon ? 'rgba(255,165,0,0.5)' : 'rgba(255,255,255,0.3)'}`,
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
          {certification.cert_name || certification.cert_type || "Unknown"}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: W,
          background: getCertStatusColor(certification.cert_status),
          padding: "4px 10px",
          borderRadius: 8,
          textTransform: "uppercase",
        }}>
          {certification.cert_status || "N/A"}
        </span>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
          <strong>Issue Date:</strong> {formatDate(certification.issued_date)}
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
          <strong>Expiry Date:</strong> {formatDate(certification.expiry_date)}
        </div>
        {certification.issuing_body && (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
            <strong>Authority:</strong> {certification.issuing_body}
          </div>
        )}
      </div>
      
      {isExpiringSoon && !isExpired && (
        <div style={{
          fontSize: 12,
          padding: "6px 10px",
          background: "rgba(255,165,0,0.3)",
          border: "1px solid rgba(255,165,0,0.5)",
          borderRadius: 6,
          color: W,
          textAlign: "center",
        }}>
          ⚠️ Expires in {certification.days_until_expiry} days
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ ASSIGNMENT CARD ═══════════════════════ */
function AssignmentCard({ assignment, residents, isMobile, onResidentClick }) {
  // Get resident info from the residents map
  const residentInfo = residents[assignment.resident_id] || {};
  const residentName = assignment.resident_name || residentInfo.name || 'Unknown Resident';
  const roomId = assignment.room_id || residentInfo.room_id || 'N/A';
  
  return (
    <div style={{
      background: "rgba(255,255,255,0.08)",
      border: "1.5px solid rgba(255,255,255,0.25)",
      borderRadius: 12,
      padding: isMobile ? "12px" : "16px",
      display: "flex",
      alignItems: "center",
      gap: 16,
      transition: "all 0.2s",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(255,255,255,0.12)";
      e.currentTarget.style.transform = "translateX(4px)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      e.currentTarget.style.transform = "translateX(0)";
    }}
    onClick={() => onResidentClick && onResidentClick(assignment.resident_id)}
    >
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#042558" strokeWidth="2">
          <circle cx="12" cy="8" r="4"/>
          <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
        </svg>
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontSize: 16, 
          fontWeight: 700, 
          color: W, 
          marginBottom: 4,
          textDecoration: "underline",
          textDecorationColor: "rgba(255,255,255,0.5)",
          cursor: "pointer"
        }}>
          {residentName}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
          <strong>Date:</strong> {formatDate(assignment.shift_date)} • <strong>Shift:</strong> {assignment.shift_type || "N/A"}
        </div>
      </div>
      
      <div style={{
        padding: "4px 10px",
        background: "rgba(74,144,226,0.3)",
        border: "1px solid rgba(74,144,226,0.5)",
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        color: W,
        whiteSpace: "nowrap",
      }}>
        Room {roomId}
      </div>
      
      {/* Arrow indicator */}
      <div style={{
        width: 24,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2.5" strokeLinecap="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </div>
  );
}

/* ═══════════════════════ METRIC CARD ═══════════════════════ */
function MetricCard({ title, value, subtitle, icon }) {
  const getIcon = () => {
    switch(icon) {
      case "falls":
        return <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>;
      case "time":
        return <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>;
      case "alerts":
        return <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>;
      case "residents":
        return <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>;
      case "satisfaction":
        return <><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></>;
      case "completion":
        return <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>;
      case "tasks":
        return <><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>;
      default:
        return <circle cx="12" cy="12" r="10"/>;
    }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.08)",
      border: "1.5px solid rgba(255,255,255,0.25)",
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: 16,
    }}>
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
    case "ON_LEAVE": return "#FFA500";
    case "TERMINATED": return "#666666";
    default: return "#4A90E2";
  }
}

function getRoleColor(role) {
  switch(role?.toUpperCase()) {
    case "RN": return "#6ADD00";
    case "LPN": return "#4A90E2";
    case "CNA": return "#FFA500";
    case "PT": return "#9B59B6";
    default: return W;
  }
}

function getShiftColor(shift) {
  switch(shift?.toUpperCase()) {
    case "DAY": return "#FFD700";
    case "EVENING": return "#FFA500";
    case "NIGHT": return "#4A90E2";
    default: return W;
  }
}

function getCertStatusColor(status) {
  switch(status?.toUpperCase()) {
    case "ACTIVE": return "#6ADD00";
    case "EXPIRING_SOON": return "#FFA500";
    case "EXPIRED": return "#FF6B6B";
    default: return "#666666";
  }
}
