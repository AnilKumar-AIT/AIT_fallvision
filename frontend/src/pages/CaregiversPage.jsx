import { useState, useEffect, useCallback } from "react";
import useWindowSize from "../hooks/useWindowSize";
import apiService from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import profileIcon from "../assets/caregivers.svg";
import trashIcon from "../assets/Trash.svg";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const W = "#ffffff";

/* ═══════════════════════ FILTER BUTTON COMPONENT (EXPORTED) ═══════════════════════ */
export function FilterButton({ label, value, options, onChange, isMobile }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: value === "All" ? "rgba(255,255,255,0.08)" : "rgba(74,144,226,0.25)",
          border: `1.5px solid ${value === "All" ? "rgba(255,255,255,0.25)" : "rgba(74,144,226,0.5)"}`,
          borderRadius: 8,
          padding: isMobile ? "6px 10px" : "8px 14px",
          fontSize: isMobile ? 11 : 13,
          fontWeight: 600,
          color: W,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ opacity: 0.7 }}>{label}:</span>
        <span>{value}</span>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke={W} 
          strokeWidth="2.5"
          style={{ 
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s"
          }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "transparent",
            }}
          />
          <div style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 1001,
            background: "#0e2240",
            border: "1.5px solid rgba(255,255,255,0.3)",
            borderRadius: 8,
            padding: "6px",
            minWidth: 120,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}>
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  background: value === option ? "rgba(74,144,226,0.3)" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: isMobile ? 11 : 13,
                  fontWeight: value === option ? 700 : 400,
                  color: W,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (value !== option) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  if (value !== option) e.currentTarget.style.background = "transparent";
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════ CAREGIVERS PAGE ═══════════════════════ */
export default function CaregiversPage({ onFiltersChange, onCaregiverClick, onAddCaregiver, onEditCaregiver }) {
  const [caregivers, setCaregivers] = useState([]);
  const [filteredCaregivers, setFilteredCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("All");
  const [selectedShift, setSelectedShift] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

    const { isMobile } = useWindowSize();

  // Expose filters to parent (Sidebar)
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange({
        selectedRole,
        setSelectedRole,
        selectedShift,
        setSelectedShift,
        selectedStatus,
        setSelectedStatus,
      });
    }
  }, [selectedRole, selectedShift, selectedStatus, onFiltersChange]);

  useEffect(() => {
    loadCaregivers();
  }, []);

  const loadCaregivers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getAllCaregivers();
      
      
      if (!data || !data.caregivers || data.caregivers.length === 0) {
        console.warn('No caregivers data received from API');
        setCaregivers([]);
        return;
      }
      
      const transformedCaregivers = data.caregivers.map((c, index) => {
        let displayName = 'Unknown Caregiver';
        if (c.display_name) {
          displayName = c.display_name;
        } else if (c.first_name || c.last_name) {
          displayName = `${c.first_name || ''} ${c.last_name || ''}`.trim();
        }
        
        return {
          caregiver_id: c.caregiver_id || `CG#unknown-${index}`,
          name: displayName,
          role: c.role || 'N/A',
          primary_shift: c.primary_shift || 'N/A',
          badge_id: (c.badge_id || '').replace('BADGE#', '') || 'N/A',
          status: c.status || 'ACTIVE',
          email: c.email || 'N/A',
          phone: c.phone || 'N/A',
        };
      });
      
      
      setCaregivers(transformedCaregivers);
    } catch (err) {
      console.error('Failed to load caregivers:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const filterCaregivers = useCallback(() => {
    let filtered = [...caregivers];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        (c.name || "").toLowerCase().includes(search) ||
        (c.caregiver_id || "").toLowerCase().includes(search) ||
        (c.role || "").toLowerCase().includes(search) ||
        (c.badge_id || "").toLowerCase().includes(search)
      );
    }

    if (selectedRole !== "All") {
      filtered = filtered.filter(c => c.role === selectedRole);
    }

    if (selectedShift !== "All") {
      filtered = filtered.filter(c => c.primary_shift === selectedShift);
    }

    if (selectedStatus !== "All") {
      filtered = filtered.filter(c => c.status === selectedStatus);
    }

    setFilteredCaregivers(filtered);
    setCurrentPage(1);
  }, [caregivers, searchTerm, selectedRole, selectedShift, selectedStatus]);

  useEffect(() => {
    filterCaregivers();
  }, [filterCaregivers]);

  const handleDeleteCaregiver = async (caregiverId) => {
    if (!window.confirm("Are you sure you want to remove this caregiver?")) {
      return;
    }
    try {
      alert('Delete functionality will be implemented soon.');
    } catch (err) {
      console.error('Failed to delete caregiver:', err);
      alert('Failed to delete caregiver. Please try again.');
    }
  };

  if (loading) {
    return (
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120, minHeight: "100vh" }}>
        <LoadingSpinner message="Loading caregivers..." />
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120, minHeight: "100vh" }}>
        <ErrorMessage error={error} onRetry={loadCaregivers} />
      </main>
    );
  }

  const gap = isMobile ? 8 : 10;
  const cardPadding = isMobile ? "14px 16px" : "16px 20px";
  const totalPages = Math.ceil(filteredCaregivers.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredCaregivers.slice(indexOfFirstRecord, indexOfLastRecord);

  return (
    <main style={{
      flex: 1,
      padding: isMobile ? "10px 10px" : "12px 60px",
      overflowY: "hidden",
      display: "flex",
      flexDirection: "column",
      gap,
      minWidth: 0,
      fontFamily: "'Segoe UI', sans-serif",
      color: W,
      position: "relative",
      zIndex: 1,
      paddingTop: isMobile ? 80 : 150,
      paddingBottom: isMobile ? 10 : 6,
      marginTop: 0,
      height: "100vh",
      boxSizing: "border-box",
    }}>
      
      {/* SEARCH BAR & ADD CAREGIVER */}
      <div style={{
        background: "#042558",
        border: "1px solid #FFFFFF",
        borderRadius: 20,
        padding: cardPadding,
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 10 : 16,
        flexWrap: isMobile ? "wrap" : "nowrap",
      }}>
        <button style={{
          background: "rgba(255,255,255,0.12)",
          border: "1px solid #FFFFFF",
          borderRadius: 16,
          padding: "20px",
          fontSize: 20,
          fontWeight: 400,
          color: W,
          cursor: "pointer",
          whiteSpace: "nowrap",
          lineHeight: "94%",
        }}>
          Caregivers
        </button>

        <div style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          background: "rgba(26, 62, 110, 0.6)",
          borderRadius: 50,
          padding: "12px 20px",
          minWidth: isMobile ? "100%" : 200,
          gap: 12,
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#042558" strokeWidth="2">
              <circle cx="12" cy="8" r="4"/>
              <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
            </svg>
          </div>

          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              background: "#FFFFFF",
              border: "none",
              outline: "none",
              color: "#5A5A5A",
              fontSize: 16,
              fontFamily: "'Segoe UI', sans-serif",
              padding: "10px 16px",
              borderRadius: 25,
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={{
                background: "transparent",
                border: "none",
                color: "#FFFFFF",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                position: "absolute",
                right: 24,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A5A5A" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        <span 
          onClick={() => onAddCaregiver && onAddCaregiver()}
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: W,
            whiteSpace: "nowrap",
            flexShrink: 0,
            cursor: "pointer",
          }}
        >
          Add Caregiver
        </span>

        <div style={{
          position: "relative",
          width: 94,
          height: 94,
          flexShrink: 0,
        }}>
          <div style={{
            position: "absolute",
            width: 94,
            height: 94,
            background: "#6ADD00",
            borderRadius: "50%",
          }} />
          <button 
          onClick={() => onAddCaregiver && onAddCaregiver()}
          style={{
            position: "absolute",
            left: 9,
            top: 9,
            width: 76,
            height: 76,
            background: "#D9D9D9",
            border: "none",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0px 4px 9.8px 9px rgba(0, 0, 0, 0.25), inset 0px 2px 9px 3px rgba(0, 0, 0, 0.27)",
          }}
          title="Add Caregiver"
          >
            <img 
              src={profileIcon} 
              alt="Add Caregiver" 
              style={{ width: 41, height: 41 }}
            />
          </button>
        </div>
      </div>

      {/* CAREGIVERS GRID */}
      <div style={{
        background: "#042558",
        border: "1px solid #FFFFFF",
        borderRadius: 20,
        padding: isMobile ? "20px" : "30px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 16 : 20,
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
          paddingRight: 8,
        }}>
          {currentRecords.length === 0 ? (
            <div style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "40px 20px",
              color: W,
              opacity: 0.6,
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              <p style={{ fontSize: 16, margin: 0 }}>
                {searchTerm ? "No caregivers found matching your search" : "No caregivers available"}
              </p>
            </div>
          ) : (
            currentRecords.map((caregiver) => (
              <CaregiverCard
                key={caregiver.caregiver_id}
                caregiver={caregiver}
                onDelete={handleDeleteCaregiver}
                onEdit={onEditCaregiver}
                onClick={() => onCaregiverClick && onCaregiverClick(caregiver.caregiver_id)}
                isMobile={isMobile}
              />
            ))
          )}
        </div>

        {/* PAGINATION */}
        {filteredCaregivers.length > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 16,
            paddingBottom: 4,
            marginTop: 8,
            borderTop: "2px solid rgba(255,255,255,0.3)",
            flexWrap: isMobile ? "wrap" : "nowrap",
            gap: 16,
          }}>
            <span style={{ color: W, fontSize: isMobile ? 12 : 14, fontWeight: 500, whiteSpace: "nowrap" }}>
              Showing {indexOfFirstRecord + 1} - {Math.min(indexOfLastRecord, filteredCaregivers.length)} of {filteredCaregivers.length} caregivers
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  padding: "10px 16px",
                  background: currentPage === 1 ? "rgba(255,255,255,0.08)" : "rgba(74,144,226,0.4)",
                  border: `2px solid ${currentPage === 1 ? "rgba(255,255,255,0.2)" : "rgba(74,144,226,0.8)"}`,
                  borderRadius: 10,
                  color: W,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  opacity: currentPage === 1 ? 0.4 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="3">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                {!isMobile && "Prev"}
              </button>

              {totalPages > 1 && Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => {
                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      style={{
                        width: 40,
                        height: 40,
                        background: currentPage === pageNumber ? "rgba(74,144,226,0.8)" : "rgba(255,255,255,0.12)",
                        border: `2px solid ${currentPage === pageNumber ? "rgba(74,144,226,1)" : "rgba(255,255,255,0.25)"}`,
                        borderRadius: 10,
                        color: W,
                        cursor: "pointer",
                        fontSize: 15,
                        fontWeight: currentPage === pageNumber ? 800 : 600,
                      }}
                    >
                      {pageNumber}
                    </button>
                  );
                }
                return null;
              })}

              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  padding: "10px 16px",
                  background: currentPage === totalPages ? "rgba(255,255,255,0.08)" : "rgba(74,144,226,0.4)",
                  border: `2px solid ${currentPage === totalPages ? "rgba(255,255,255,0.2)" : "rgba(74,144,226,0.8)"}`,
                  borderRadius: 10,
                  color: W,
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  opacity: currentPage === totalPages ? 0.4 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {!isMobile && "Next"}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="3">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* CAREGIVER CARD */
function CaregiverCard({ caregiver, onDelete, onEdit, onClick, isMobile }) {
  return (
    <div 
      onClick={onClick}
      style={{
      background: "rgba(255, 255, 255, 0.12)",
      border: "2px solid #FFFFFF",
      borderRadius: 16,
      padding: 16,
      height: 60,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      transition: "transform 0.2s, box-shadow 0.2s",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}
    >
      <div style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        border: "1px solid #FFFFFF",
        background: "#D9D9D9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#042558" strokeWidth="2">
          <circle cx="12" cy="8" r="4"/>
          <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
        <p style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 400,
          fontFamily: "'Konnect', sans-serif",
          lineHeight: "21px",
          color: W,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {caregiver.name || "Unknown Caregiver"}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit && onEdit(caregiver);
        }}
        style={{
          background: "transparent",
          border: "none",
          width: 18,
          height: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
        title="Edit caregiver"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(caregiver.caregiver_id);
        }}
        style={{
          background: "transparent",
          border: "none",
          width: 18,
          height: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
        title="Remove caregiver"
      >
        <img src={trashIcon} alt="Delete" style={{ width: 18, height: 18 }} />
      </button>
    </div>
  );
}
