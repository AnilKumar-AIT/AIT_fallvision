/**
 * CaregiverDetailsPage.jsx
 * 
 * @fileoverview Comprehensive caregiver details page displaying profile information,
 * certifications, resident assignments, and performance metrics for a specific caregiver.
 * 
 * @description This page provides a detailed view of a caregiver's information including:
 * - Personal and employment details (name, role, badge ID, employee ID, contact info)
 * - Professional certifications and licenses with expiration tracking
 * - Recent resident assignments with clickable navigation
 * - Performance metrics (falls responded, response times, alerts, residents served)
 * - Responsive design that adapts to mobile and desktop viewports
 * 
 * @exports CaregiverDetailsPage - Main page component
 * 
 * @requires react - For component state and lifecycle management
 * @requires ../hooks/useWindowSize - Custom hook for responsive design
 * @requires ../services/api - API service for backend data fetching
 * @requires ../components/LoadingSpinner - Loading state component
 * @requires ../components/ErrorMessage - Error display component
 * 
 * @usage
 * <CaregiverDetailsPage 
 *   caregiverId="CAREGIVER#cg-123" 
 *   onBack={() => navigate('/caregivers')}
 *   onNavigateToScreen={(screen, id) => navigate(`/${screen}/${id}`)}
 * />
 */

import { useState, useEffect } from "react";
import useWindowSize from "../hooks/useWindowSize";
import apiService from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */

/** @constant {string} W - White color constant used throughout the component */
const W = "#ffffff";

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */

/**
 * CaregiverDetailsPage - Main component for displaying detailed caregiver information
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.caregiverId - Unique identifier for the caregiver (e.g., "CAREGIVER#cg-123")
 * @param {Function} props.onBack - Callback function to navigate back to caregivers list
 * @param {Function} props.onNavigateToScreen - Callback function to navigate to other screens
 *   @param {string} screen - Screen name to navigate to (e.g., 'resident-details')
 *   @param {string} id - ID of the entity to view
 * 
 * @returns {JSX.Element} Rendered caregiver details page with profile, certifications, 
 *   assignments, and performance metrics
 * 
 * @description
 * Fetches and displays comprehensive caregiver information including:
 * - Profile details (photo, name, role, contact info, employment details)
 * - Certifications and licenses with expiration warnings
 * - Recent resident assignments (up to 5 most recent)
 * - Performance metrics (if available)
 * 
 * The component handles loading and error states gracefully, with non-critical data
 * failures not preventing the page from displaying.
 */
export default function CaregiverDetailsPage({ caregiverId, onBack, onNavigateToScreen }) {
    // ═══ RESPONSIVE DESIGN HOOK ═══
  const { isMobile } = useWindowSize();
  
  // ═══ STATE MANAGEMENT ═══
  /** @state {Object|null} caregiver - Main caregiver profile data */
  const [caregiver, setCaregiver] = useState(null);
  
  /** @state {Array} certifications - List of caregiver certifications and licenses */
  const [certifications, setCertifications] = useState([]);
  
  /** @state {Array} assignments - List of recent resident assignments */
  const [assignments, setAssignments] = useState([]);
  
  /** @state {Array} schedule - Caregiver schedule data (currently fetched but not displayed) */
  // eslint-disable-next-line no-unused-vars
  const [schedule, setSchedule] = useState([]);
  
  /** @state {Object} performance - Performance metrics data */
  const [performance, setPerformance] = useState({});
  
  /** @state {Object} residents - Map of resident IDs to resident data for assignment display */
  const [residents, setResidents] = useState({});
  
  /** @state {boolean} loading - Loading state indicator */
  const [loading, setLoading] = useState(true);
  
  /** @state {Error|null} error - Error object if critical data fetch fails */
  const [error, setError] = useState(null);

    // ═══ LIFECYCLE EFFECTS ═══
  
    /**
   * Load caregiver details when component mounts or caregiverId changes
   */
  useEffect(() => {
    loadCaregiverDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caregiverId]);

    // ═══ DATA FETCHING ═══
  
  /**
   * Load all caregiver-related data from the API
   * 
   * @async
   * @function loadCaregiverDetails
   * @returns {Promise<void>}
   * 
   * @description
   * Fetches caregiver data in the following order:
   * 1. Caregiver profile (CRITICAL - failure shows error page)
   * 2. Certifications (non-critical)
   * 3. Assignments (non-critical)
   * 4. All residents data for mapping IDs to names (non-critical)
   * 5. Schedule (non-critical, currently unused)
   * 6. Performance metrics (non-critical, 404 is acceptable)
   * 
   * Non-critical failures are caught individually and set empty defaults,
   * allowing the page to display with partial data.
   */
  const loadCaregiverDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // ─── CRITICAL DATA: Caregiver Profile ───
      // If this fails, the entire page will show an error
      const caregiverData = await apiService.getCaregiverDetails(caregiverId);
      
            setCaregiver(caregiverData);
      
      // ─── NON-CRITICAL DATA: Certifications ───
      try {
        const certsData = await apiService.getCaregiverCertifications(caregiverId);
        setCertifications(certsData?.certifications || []);
        
            } catch (err) {
                setCertifications([]);
      }
      
      // ─── NON-CRITICAL DATA: Assignments ───
      try {
        const assignmentsData = await apiService.getCaregiverAssignments(caregiverId);
        setAssignments(assignmentsData?.assignments || []);
        
            } catch (err) {
                setAssignments([]);
      }
      
      // ─── NON-CRITICAL DATA: Residents Mapping ───
      // Fetch all residents to enable name/room display in assignments
      try {
                const residentsData = await apiService.getAllResidents();
        if (residentsData && residentsData.residents) {
          const residentsMap = {};
          residentsData.residents.forEach(r => {
            // Parse the status_name_sort field which has format: "STATUS#LastName#FirstName"
            let displayName = 'Unknown Resident';
            if (r.status_name_sort) {
              const parts = r.status_name_sort.split('#');
              if (parts.length >= 3) {
                const lastName = parts[1] || '';
                const firstName = parts[2] || '';
                displayName = `${firstName} ${lastName}`.trim();
              }
            }
            // Store resident info by ID for quick lookup in assignments
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
      
      // ─── NON-CRITICAL DATA: Schedule ───
      // Note: Schedule data is fetched but not currently displayed in the UI
      try {
        const scheduleData = await apiService.getCaregiverSchedule(caregiverId);
        setSchedule(scheduleData?.schedule || []);
        
            } catch (err) {
                setSchedule([]);
      }
      
      // ─── NON-CRITICAL DATA: Performance Metrics ───
      // 404 responses are acceptable - new caregivers may not have performance data yet
      try {
        const perfData = await apiService.getCaregiverPerformance(caregiverId);
        setPerformance(perfData || {});
        
                  } catch (err) {
        // Performance data unavailable is not an error condition
        // Display a friendly message instead
        setPerformance({
          message: 'Performance data not available yet'
        });
      }
      
            } catch (err) {
      // Only critical errors (caregiver profile fetch failure) reach here
      setError(err);
    } finally {
      setLoading(false);
    }
  };

    // ═══ LOADING STATE ═══
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

    // ═══ ERROR STATE ═══
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

    // ═══ RESPONSIVE LAYOUT VARIABLES ═══
  const gap = isMobile ? 12 : 16;
  const cardPadding = isMobile ? "16px 18px" : "20px 24px";

  // ═══ MAIN RENDER ═══
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
                  // Navigate to resident details page when assignment is clicked
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
      {/* Only show performance section if data exists and is not just a message */}
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

/**
 * DetailField - Displays a labeled field with optional color styling
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.label - Field label (displayed in uppercase)
 * @param {string} props.value - Field value to display
 * @param {string} [props.valueColor] - Optional color for the value text (defaults to white)
 * 
 * @returns {JSX.Element} Rendered detail field with label and value
 * 
 * @example
 * <DetailField label="Name" value="John Doe" />
 * <DetailField label="Role" value="RN" valueColor="#6ADD00" />
 */
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

/**
 * CertificationCard - Displays a single certification or license with expiration tracking
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.certification - Certification data object
 * @param {string} props.certification.cert_name - Certification name
 * @param {string} props.certification.cert_type - Certification type (fallback if name not available)
 * @param {string} props.certification.cert_status - Status (ACTIVE, EXPIRING_SOON, EXPIRED)
 * @param {string} props.certification.issued_date - ISO date string of issue date
 * @param {string} props.certification.expiry_date - ISO date string of expiration date
 * @param {string} [props.certification.issuing_body] - Organization that issued the certification
 * @param {number} [props.certification.days_until_expiry] - Days until expiration
 * @param {boolean} props.isMobile - Whether the viewport is mobile-sized
 * 
 * @returns {JSX.Element} Rendered certification card with status indicator and expiration warning
 * 
 * @description
 * Displays certification details with visual indicators:
 * - Border color changes based on expiration status (red=expired, orange=expiring soon)
 * - Warning badge for certifications expiring within 30 days
 * - Status badge with color coding
 */
function CertificationCard({ certification, isMobile }) {
  // Determine expiration status for visual indicators
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

/**
 * AssignmentCard - Displays a single resident assignment with clickable navigation
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.assignment - Assignment data object
 * @param {string} props.assignment.resident_id - Unique resident identifier
 * @param {string} [props.assignment.resident_name] - Resident name (if available in assignment)
 * @param {string} [props.assignment.room_id] - Room ID (if available in assignment)
 * @param {string} props.assignment.shift_date - ISO date string of the shift
 * @param {string} props.assignment.shift_type - Type of shift (DAY, EVENING, NIGHT)
 * @param {Object} props.residents - Map of resident IDs to resident data
 * @param {boolean} props.isMobile - Whether the viewport is mobile-sized
 * @param {Function} props.onResidentClick - Callback when assignment is clicked
 *   @param {string} residentId - ID of the resident to navigate to
 * 
 * @returns {JSX.Element} Rendered assignment card with hover effects and navigation
 * 
 * @description
 * Displays a resident assignment with:
 * - Resident avatar icon
 * - Resident name (from assignment or residents map)
 * - Shift date and type
 * - Room number badge
 * - Arrow indicator for navigation
 * - Hover effects (background change and slide animation)
 */
function AssignmentCard({ assignment, residents, isMobile, onResidentClick }) {
  // Resolve resident information from multiple sources (assignment data or residents map)
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

/**
 * MetricCard - Displays a performance metric with icon, value, and subtitle
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.title - Metric title/label
 * @param {string|number} props.value - Metric value to display
 * @param {string} [props.subtitle] - Optional subtitle/description
 * @param {string} props.icon - Icon type identifier (falls, time, alerts, residents, etc.)
 * 
 * @returns {JSX.Element} Rendered metric card with icon and values
 * 
 * @description
 * Displays a performance metric in a card format with:
 * - Icon representing the metric type
 * - Large value display
 * - Optional subtitle for context
 * - Consistent styling with other cards
 */
function MetricCard({ title, value, subtitle, icon }) {
  /**
   * Get SVG path elements for the specified icon type
   * 
   * @function getIcon
   * @returns {JSX.Element} SVG path elements for the icon
   */
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

/**
 * Format an ISO date string to a human-readable format
 * 
 * @function formatDate
 * @param {string} dateString - ISO date string to format
 * @returns {string} Formatted date string (e.g., "Jan 15, 2024") or "N/A" if invalid
 * 
 * @example
 * formatDate("2024-01-15T10:30:00Z") // Returns "Jan 15, 2024"
 * formatDate(null) // Returns "N/A"
 */
function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Get color code for caregiver employment status
 * 
 * @function getStatusColor
 * @param {string} status - Employment status (ACTIVE, ON_LEAVE, TERMINATED)
 * @returns {string} Hex color code for the status
 * 
 * @description
 * Color mapping:
 * - ACTIVE: Green (#6ADD00)
 * - ON_LEAVE: Orange (#FFA500)
 * - TERMINATED: Gray (#666666)
 * - Default: Blue (#4A90E2)
 */
function getStatusColor(status) {
  switch(status?.toUpperCase()) {
    case "ACTIVE": return "#6ADD00";
    case "ON_LEAVE": return "#FFA500";
    case "TERMINATED": return "#666666";
    default: return "#4A90E2";
  }
}

/**
 * Get color code for caregiver role
 * 
 * @function getRoleColor
 * @param {string} role - Caregiver role (RN, LPN, CNA, PT)
 * @returns {string} Hex color code for the role
 * 
 * @description
 * Color mapping:
 * - RN (Registered Nurse): Green (#6ADD00)
 * - LPN (Licensed Practical Nurse): Blue (#4A90E2)
 * - CNA (Certified Nursing Assistant): Orange (#FFA500)
 * - PT (Physical Therapist): Purple (#9B59B6)
 * - Default: White
 */
function getRoleColor(role) {
  switch(role?.toUpperCase()) {
    case "RN": return "#6ADD00";
    case "LPN": return "#4A90E2";
    case "CNA": return "#FFA500";
    case "PT": return "#9B59B6";
    default: return W;
  }
}

/**
 * Get color code for shift type
 * 
 * @function getShiftColor
 * @param {string} shift - Shift type (DAY, EVENING, NIGHT)
 * @returns {string} Hex color code for the shift
 * 
 * @description
 * Color mapping:
 * - DAY: Gold (#FFD700)
 * - EVENING: Orange (#FFA500)
 * - NIGHT: Blue (#4A90E2)
 * - Default: White
 */
function getShiftColor(shift) {
  switch(shift?.toUpperCase()) {
    case "DAY": return "#FFD700";
    case "EVENING": return "#FFA500";
    case "NIGHT": return "#4A90E2";
    default: return W;
  }
}

/**
 * Get color code for certification status
 * 
 * @function getCertStatusColor
 * @param {string} status - Certification status (ACTIVE, EXPIRING_SOON, EXPIRED)
 * @returns {string} Hex color code for the status
 * 
 * @description
 * Color mapping:
 * - ACTIVE: Green (#6ADD00)
 * - EXPIRING_SOON: Orange (#FFA500)
 * - EXPIRED: Red (#FF6B6B)
 * - Default: Gray (#666666)
 */
function getCertStatusColor(status) {
  switch(status?.toUpperCase()) {
    case "ACTIVE": return "#6ADD00";
    case "EXPIRING_SOON": return "#FFA500";
    case "EXPIRED": return "#FF6B6B";
    default: return "#666666";
  }
}
