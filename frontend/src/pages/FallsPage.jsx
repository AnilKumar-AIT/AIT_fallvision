import { useState, useEffect, useCallback } from "react";
import useWindowSize from "../hooks/useWindowSize";
import apiService from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import VideoPlayer from "../components/VideoPlayer";
import calendarIcon from "../assets/calendar.svg";
import clockIcon from "../assets/clock.svg";
import hospitalIcon from "../assets/hospital.svg";
import sendIcon from "../assets/send.svg";
import seniorIcon from "../assets/senior.svg";
import videoIcon from "../assets/video.svg";
import viewAllIcon from "../assets/view_all.png";
import threeDotsIcon from "../assets/three_dots.svg";
import commentIcon from "../assets/comment.svg";
import fullscreenIcon from "../assets/fullscreen.svg";
import fallGraphIcon from "../assets/fall_graph.svg";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const W = "#ffffff";
const DEFAULT_RESIDENT_ID = "RES#res-20251112-0001"; // Same as Sleep Diary and Gait pages

/* ═══════════════════════ PAGE ═══════════════════════ */
export default function FallsPage({ onFiltersChange, residentId, showBackButton, onBackToResident }) {
  const [fallRecords, setFallRecords] = useState([]);
  const [fallAnalyticsData, setFallAnalyticsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFalls, setFilteredFalls] = useState([]);
  const [displayedFallsCount, setDisplayedFallsCount] = useState(20); // Show first 20 records
  const RECORDS_PER_PAGE = 20;
    const [selectedFall, setSelectedFall] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [videoProgress, setVideoProgress] = useState(42);
  // eslint-disable-next-line no-unused-vars
  const [currentTime, setCurrentTime] = useState("42:38");
  const { isMobile } = useWindowSize();

  // Falls page filter states
  const [selectedAge, setSelectedAge] = useState("All");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("All");
  const [selectedSleepQuality, setSelectedSleepQuality] = useState("All");

  // Expose filters to parent (Sidebar)
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange({
        selectedAge,
        setSelectedAge,
        selectedRiskLevel,
        setSelectedRiskLevel,
        selectedSleepQuality,
        setSelectedSleepQuality,
      });
    }
  }, [selectedAge, selectedRiskLevel, selectedSleepQuality, onFiltersChange]);

                const loadFallData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use provided residentId or fall back to default
        const targetResidentId = residentId || DEFAULT_RESIDENT_ID;
        
        // Load falls for the specified resident
        const [fallsData, analyticsData] = await Promise.all([
          apiService.getAllFalls(90), // Get last 90 days
          apiService.getFallAnalytics(1)
        ]);
      
        const residentFalls = (fallsData.falls || []).filter(
          fall => fall.resident_id === targetResidentId
        );

                // Debug: Log photo_s3_key values
        console.log('[FallsPage] Loaded falls:', residentFalls.length);
        residentFalls.forEach((fall, idx) => {
          console.log(`[FallsPage] Fall ${idx}: resident_name='${fall.resident_name}', photo_s3_key='${fall.photo_s3_key}'`);
        });
      
        setFallRecords(residentFalls);
                setFallAnalyticsData(analyticsData.analytics || []);
      } catch (err) {
        console.error('Failed to load fall data:', err);
        console.error('Resident ID that failed:', residentId || DEFAULT_RESIDENT_ID);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

        // Load fall data on mount or when residentId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadFallData(); }, [residentId]);

        // Handle fall record click - show specific fall incident details
  const handleFallRecordClick = async (fall) => {
    // If clicking the same fall, deselect
    if (selectedFall?.fall_id === fall.fall_id) {
      setSelectedFall(null);
      setVideoUrl(null);
      loadFallData(); // Reload facility-wide analytics
    } else {
      setSelectedFall(fall);
      
      // Fetch video URL from backend
      setVideoLoading(true);
      try {
        const videoData = await apiService.getFallVideo(fall.fall_id);
        setVideoUrl(videoData.video_url);
        console.log('[FallsPage] Video URL loaded:', videoData.video_url);
      } catch (error) {
        console.error('[FallsPage] Failed to load video:', error);
        setVideoUrl(null);
      } finally {
        setVideoLoading(false);
      }
    }
  };

  // Filter falls based on search and filters
  const filterFalls = useCallback(() => {
    let filtered = [...fallRecords];

    // Search filter
    if (searchQuery.trim()) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(fall => {
        const residentName = fall.resident_name || '';
        const roomNumber = fall.location_id || '';
        return residentName.toLowerCase().includes(search) ||
               roomNumber.toLowerCase().includes(search);
      });
    }

    // Age filter (would need resident data joined)
    // Risk level filter - using severity as proxy
    if (selectedRiskLevel !== "All") {
      const severityMap = {
        "LOW": "MINOR",
        "MODERATE": "MODERATE",
        "HIGH": "SEVERE"
      };
      const targetSeverity = severityMap[selectedRiskLevel];
      filtered = filtered.filter(fall => fall.severity === targetSeverity);
    }

    // Sort by priority (severity) and timestamp
    const severityOrder = { "SEVERE": 0, "MODERATE": 1, "MINOR": 2 };
    filtered.sort((a, b) => {
      const severityDiff = (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
      if (severityDiff !== 0) return severityDiff;
      return (b.fall_ts || '').localeCompare(a.fall_ts || '');
    });

    setFilteredFalls(filtered);
  }, [fallRecords, searchQuery, selectedRiskLevel]);

    useEffect(() => {
    filterFalls();
    // Reset displayed count when filters change
    setDisplayedFallsCount(RECORDS_PER_PAGE);
  }, [filterFalls]);

    // S3 Configuration (same as api.js)
  const S3_BUCKET = 'aitcare-dashboard-photos-dev';
  const S3_REGION = 'us-east-1';

                // Get resident photo URL from S3
  const getResidentPhoto = (photoS3Key) => {
        if (!photoS3Key || photoS3Key.trim().length === 0) {
          console.log('[FallsPage] No photo_s3_key, using fallback initials');
          return null; // Use fallback initials circle
        }
        const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${photoS3Key}`;
        console.log('[FallsPage] Generated photo URL:', url);
        return url;
  };

  // Format date and time
  const formatDateTime = (timestamp) => {
    if (!timestamp) return { date: 'N/A', time: 'N/A' };
    try {
      const dt = new Date(timestamp);
      const date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return { date, time };
    } catch {
      return { date: 'N/A', time: 'N/A' };
    }
  };

  if (loading) {
    return (
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120, minHeight: "100vh" }}>
        <LoadingSpinner message="Loading fall data..." />
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120, minHeight: "100vh" }}>
        <ErrorMessage error={error} onRetry={loadFallData} />
      </main>
    );
  }

    // Calculate max falls for chart scaling
  const maxFalls = fallAnalyticsData.length > 0 ? Math.max(...fallAnalyticsData.map(d => d.falls), 1) : 5;

  return (
    <>
            <main
        style={{
          flex: 1,
          padding: isMobile ? "10px 10px" : "12px 60px",
          overflowY: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minWidth: 0,
          fontFamily: "'Segoe UI', sans-serif",
          color: W,
          position: "relative",
          zIndex: 1,
          paddingTop: isMobile ? 100 : (showBackButton ? 150 : 110),
          paddingBottom: isMobile ? 10 : 12,
          height: "100vh",
          boxSizing: "border-box",
        }}
      >
                {/* Back to Resident Details Button */}
        {showBackButton && onBackToResident && (
          <button
            onClick={onBackToResident}
            style={{
              position: "fixed",
              top: 80,
              left: 20,
              zIndex: 1001,
              background: "rgba(4,37,88,0.95)",
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
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(4,37,88,1)";
              e.currentTarget.style.transform = "translateX(-4px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(4,37,88,0.95)";
              e.currentTarget.style.transform = "translateX(0)";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Resident Details
          </button>
        )}

        {/* Search Bar with Fall Report and View All */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: "rgba(10, 26, 48, 0.95)",
            border: "2px solid #ffffff",
            borderRadius: 16,
            padding: "12px 20px",
            flexShrink: 0,
          }}
        >
          <button
            style={{
              padding: "12px 24px",
              background: "transparent",
              border: "2px solid #ffffff",
              borderRadius: 12,
              color: W,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Fall Report
          </button>

          <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={W}
              strokeWidth="2"
              style={{ position: "absolute", left: 16, opacity: 0.5 }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: "12px 16px 12px 48px",
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                borderRadius: 12,
                color: W,
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>

          <button
            style={{
              padding: "12px 20px",
              background: "transparent",
              border: "2px solid #ffffff",
              borderRadius: 12,
              color: W,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            View All
            <img src={viewAllIcon} alt="view all" style={{ width: 20, height: 20, filter: "brightness(0) invert(1)" }} />
          </button>
        </div>

        {/* Table Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 16,
            background: "rgba(10, 26, 48, 0.95)",
            border: "2px solid #ffffff",
            borderRadius: 16,
            padding: "16px 24px",
            fontWeight: 600,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={calendarIcon} alt="calendar" style={{ width: 20, height: 20, filter: "brightness(0) invert(1)" }} />
            <img src={clockIcon} alt="clock" style={{ width: 20, height: 20, filter: "brightness(0) invert(1)" }} />
            <span>Date & Time</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={seniorIcon} alt="senior" style={{ width: 20, height: 20, filter: "brightness(0) invert(1)" }} />
            <span>Senior</span>
          </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <img src={hospitalIcon} alt="room" style={{ width: 32, height: 32, filter: "brightness(0) invert(1)" }} />
                      <span>Room No</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <img src={videoIcon} alt="video" style={{ width: 32, height: 32, filter: "brightness(0) invert(1)" }} />
                      <span>Video</span>
                    </div>
        </div>

                                                                {/* Table Rows - Show paginated fall records */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", minHeight: 0, flexShrink: 1, paddingRight: 4 }}>
                  {filteredFalls.length === 0 ? (
                    // No falls found
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "60px 20px",
                      color: W,
                      opacity: 0.7,
                    }}>
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                      </svg>
                      <p style={{ fontSize: 18, margin: "16px 0 0 0", fontWeight: 600 }}>
                        No Fall Incidents Found
                      </p>
                      <p style={{ fontSize: 14, margin: "8px 0 0 0", opacity: 0.8 }}>
                        No fall records for this resident in the selected time period
                      </p>
                    </div>
                                    ) : (
                    // Show paginated fall records
                    <>
                    {filteredFalls.slice(0, displayedFallsCount).map((record) => {
                      const { date, time } = formatDateTime(record.fall_ts);
                      const residentName = record.resident_name || "Unknown Resident";
                      const roomNumber = (record.location_id || "N/A").replace('ROOM#r-', '');
              
                      const isSelected = selectedFall?.fall_id === record.fall_id;
              
                      return (
                        <div
                          key={record.fall_id || record.fall_ts}
                          onClick={() => handleFallRecordClick(record)}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr 1fr",
                            gap: 16,
                                                        background: "rgba(10, 26, 48, 0.95)",
                            border: `2px solid ${isSelected ? '#4ade80' : '#ffffff'}`,
                            opacity: isSelected ? 1 : 0.95,
                            borderRadius: 16,
                            padding: "10px 24px",
                            fontSize: 15,
                            alignItems: "center",
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                          
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <img src={calendarIcon} alt="calendar" style={{ width: 22, height: 22, filter: "brightness(0) invert(1)" }} />
                            <span>{date}</span>
                            <img src={clockIcon} alt="clock" style={{ width: 22, height: 22, filter: "brightness(0) invert(1)", marginLeft: 8 }} />
                            <span>{time}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              {/* Resident Photo or Initials */}
                                                            {(() => {
                                const photoS3Key = record.photo_s3_key;
                                const hasPhoto = photoS3Key && photoS3Key.trim().length > 0;
                                const photoUrl = hasPhoto ? getResidentPhoto(photoS3Key) : null;
                                                        
                                const getInitials = () => {
                                  return residentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                };
                              
                                const getSeverityColor = () => {
                                  if (record.severity === 'SEVERE') return "linear-gradient(135deg, #ff6b6b 0%, #d63031 100%)";
                                  if (record.severity === 'MODERATE') return "linear-gradient(135deg, #ffa500 0%, #ff8c00 100%)";
                                  return "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)";
                                };
                              
                                return (
                                  <>
                                    {hasPhoto && photoUrl ? (
                                      <img
                                        src={photoUrl}
                                        alt={residentName}
                                        style={{
                                          width: 40,
                                          height: 40,
                                          borderRadius: "50%",
                                          objectFit: "cover",
                                          border: "2px solid #ffffff",
                                        }}
                                                                                onError={(e) => {
                                          // Replace img with initials circle on error
                                          const parent = e.target.parentNode;
                                          const initialsDiv = document.createElement('div');
                                          initialsDiv.style.cssText = `
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: ${getSeverityColor()};
                                            border: 2px solid #ffffff;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            font-size: 14px;
                                            font-weight: 700;
                                            color: #ffffff;
                                          `;
                                          initialsDiv.textContent = getInitials();
                                                                                    parent.replaceChild(initialsDiv, e.target);
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          width: 40,
                                          height: 40,
                                          borderRadius: "50%",
                                          background: getSeverityColor(),
                                          border: "2px solid #ffffff",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: 14,
                                          fontWeight: 700,
                                          color: "#ffffff",
                                        }}
                                      >
                                        {getInitials()}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                              <span>{residentName}</span>
                            </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                      <img src={hospitalIcon} alt="room" style={{ width: 36, height: 36, filter: "brightness(0) invert(1)" }} />
                                                      <span style={{ fontSize: 17, fontWeight: 600 }}>{roomNumber}</span>
                                                    </div>
                          <button
                            style={{
                              padding: "8px 16px",
                              background: "transparent",
                              border: "none",
                              borderRadius: 8,
                              color: W,
                              fontSize: 14,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                                                        <img src={sendIcon} alt="send" style={{ width: 36, height: 36, filter: "brightness(0) invert(1)" }} />
                                                        <span style={{ fontSize: 16, fontWeight: 600 }}>View Video</span>
                          </button>
                                                </div>
                      );
                    })}
                    
                    {/* Load More Button */}
                    {filteredFalls.length > displayedFallsCount && (
                      <div style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "20px",
                        marginTop: "8px"
                      }}>
                        <button
                          onClick={() => setDisplayedFallsCount(prev => prev + RECORDS_PER_PAGE)}
                          style={{
                            padding: "14px 32px",
                            background: "linear-gradient(135deg, #4a90e2 0%, #357abd 100%)",
                            border: "2px solid #ffffff",
                            borderRadius: 12,
                            color: W,
                            fontSize: 15,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.3s",
                            boxShadow: "0 4px 12px rgba(74, 144, 226, 0.3)",
                            display: "flex",
                            alignItems: "center",
                            gap: 10
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 6px 16px rgba(74, 144, 226, 0.4)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(74, 144, 226, 0.3)";
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="2.5">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                          Load More ({filteredFalls.length - displayedFallsCount} remaining)
                        </button>
                      </div>
                    )}
                    
                    {/* Showing X of Y indicator */}
                    {filteredFalls.length > 0 && (
                      <div style={{
                        textAlign: "center",
                        padding: "12px",
                        fontSize: 13,
                        opacity: 0.7,
                        fontWeight: 500
                      }}>
                        Showing {Math.min(displayedFallsCount, filteredFalls.length)} of {filteredFalls.length} fall incidents
                      </div>
                    )}
                    </>
                  )}
                </div>

                                {/* Bottom Section - Analytics and Videos - ALWAYS VISIBLE */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "0.85fr 1.15fr",
            gap: 16,
            flexShrink: 0,
            height: "320px",
            overflow: "hidden",
          }}
        >
          {/* Fall Analytics */}
          <div
            style={{
              background: "rgba(10, 26, 48, 0.95)",
              border: "2px solid #ffffff",
              borderRadius: 16,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Fall Analytics</h3>
            </div>

                        {/* Chart - Stem Chart with Y-axis labels */}
                        <div style={{ position: "relative", flex: 1, paddingTop: 20, paddingBottom: 40, paddingLeft: 40, paddingRight: 10, minHeight: 0, display: "flex" }}>
                          {/* Y-Axis with labels */}
                          <div style={{
                            position: "absolute",
                            left: 0,
                            top: 20,
                            bottom: 40,
                            width: 35,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                            paddingRight: 8,
                          }}>
                            {[5, 4, 3, 2, 1, 0].map((num) => (
                              <div key={num} style={{ fontSize: 14, fontWeight: 600, color: W, opacity: 0.8 }}>
                                {num}
                              </div>
                            ))}
                          </div>

                          {/* Y-Axis Line */}
                          <div style={{
                            position: "absolute",
                            left: 38,
                            top: 20,
                            bottom: 40,
                            width: 2,
                            background: "rgba(255, 255, 255, 0.4)",
                          }} />
              
                          {/* X-Axis Line */}
                          <div style={{
                            position: "absolute",
                            left: 38,
                            right: 10,
                            bottom: 40,
                            height: 2,
                            background: "rgba(255, 255, 255, 0.4)",
                          }} />

                          {/* Chart Content */}
                          <div style={{
                            flex: 1,
                            position: "relative",
                            display: "flex",
                            alignItems: "flex-end",
                            justifyContent: "space-around",
                            paddingLeft: 40,
                            paddingBottom: 2,
                          }}>
                            {fallAnalyticsData.map((data, idx) => {
                              const heightPercent = (data.falls / maxFalls) * 100;
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    height: "100%",
                                    justifyContent: "flex-end",
                                    position: "relative",
                                  }}
                                >
                                  {/* Circle with icon */}
                                  <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: "50%",
                                    border: "3px solid rgba(255, 255, 255, 0.9)",
                                    background: "rgba(10, 26, 48, 0.95)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: -20,
                                    position: "relative",
                                    zIndex: 2,
                                  }}>
                                    <img
                                      src={fallGraphIcon}
                                      alt="fall"
                                      style={{
                                        width: 22,
                                        height: 22,
                                        filter: "brightness(0) invert(1)",
                                      }}
                                    />
                                  </div>
                      
                                  {/* Vertical line (stem) */}
                                  <div
                                    style={{
                                      width: 3,
                                      height: `${heightPercent}%`,
                                      background: "rgba(255, 255, 255, 0.7)",
                                      minHeight: 20,
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* Time Labels */}
                          <div style={{
                            position: "absolute",
                            left: 38,
                            right: 10,
                            bottom: 8,
                            display: "flex",
                            justifyContent: "space-around",
                            paddingLeft: 2,
                          }}>
                            {fallAnalyticsData.map((data, idx) => (
                              <div key={idx} style={{ fontSize: 12, fontWeight: 500, opacity: 0.8, whiteSpace: "nowrap", textAlign: "center" }}>
                                {data.time}
                              </div>
                            ))}
                          </div>
                        </div>
          </div>

                    {/* Fall Videos - FIXED HEIGHT */}
                    <div
            style={{
              background: "rgba(10, 26, 48, 0.95)",
              border: "2px solid #ffffff",
              borderRadius: 16,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              overflow: "hidden",
            }}
          >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Fall Video</h3>
                {selectedFall && (
                  <p style={{ margin: "4px 0 0 0", fontSize: 12, opacity: 0.7 }}>
                    {selectedFall.resident_name} - {formatDateTime(selectedFall.fall_ts).date} {formatDateTime(selectedFall.fall_ts).time}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={threeDotsIcon} alt="options" style={{ width: 24, height: 24, cursor: "pointer", filter: "brightness(0) invert(1)" }} />
                <img src={commentIcon} alt="comment" style={{ width: 24, height: 24, cursor: "pointer", filter: "brightness(0) invert(1)" }} />
                <img
                  src={fullscreenIcon}
                  alt="fullscreen"
                  onClick={() => setShowFullscreenModal(true)}
                  style={{ width: 24, height: 24, cursor: "pointer", filter: "brightness(0) invert(1)" }}
                />
              </div>
            </div>

                                                                                                {/* Video Player and Details - Side by Side */}
            {videoLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <LoadingSpinner message="Loading video..." />
                </div>
              </div>
            ) : videoUrl && selectedFall ? (
              <VideoPlayer videoUrl={videoUrl} fallInfo={selectedFall} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px", opacity: 0.6 }}>
                <div style={{ textAlign: "center" }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="1.5">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                    <line x1="7" y1="2" x2="7" y2="22"/>
                    <line x1="17" y1="2" x2="17" y2="22"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                  </svg>
                  <p style={{ fontSize: 14, margin: "12px 0 0 0" }}>
                    {selectedFall ? 'Video not available for this fall event' : 'Click on a fall incident to view video'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Fullscreen Video Modal */}
      {showFullscreenModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.95)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowFullscreenModal(false)}
        >
          <div
            style={{
              width: "90%",
              maxWidth: 1200,
              background: "rgba(10, 26, 48, 0.95)",
              border: "2px solid #ffffff",
              borderRadius: 16,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: W }}>
                Fall Video - Full Screen
              </h3>
              <button
                onClick={() => setShowFullscreenModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: W,
                  fontSize: 32,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

                        {/* Fullscreen Video Player */}
            {videoUrl && selectedFall ? (
              <div style={{ width: "100%", aspectRatio: "16/9", position: "relative" }}>
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    background: "rgba(0, 0, 0, 0.9)",
                    borderRadius: 12,
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "16/9",
                  background: "rgba(0, 0, 0, 0.6)",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: W,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="1.5">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                    <line x1="7" y1="2" x2="7" y2="22"/>
                    <line x1="17" y1="2" x2="17" y2="22"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                  </svg>
                  <p style={{ fontSize: 16, margin: "16px 0 0 0" }}>
                    {selectedFall ? 'Video not available' : 'Please select a fall incident first'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
