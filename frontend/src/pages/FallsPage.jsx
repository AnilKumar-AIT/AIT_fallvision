import { useState } from "react";
import useWindowSize from "../hooks/useWindowSize";
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
import nextIcon from "../assets/next.svg";
import fallGraphIcon from "../assets/fall_graph.svg";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const W = "#ffffff";

// Mock data for fall records
const fallRecords = [
  { id: 1, date: "16-2-2025", time: "10:20:22", senior: "James Smith", room: "MOTI-C4" },
  { id: 2, date: "16-2-2025", time: "10:20:22", senior: "James Smith", room: "MOTI-C4" },
  { id: 3, date: "16-2-2025", time: "10:20:22", senior: "James Smith", room: "MOTI-C4" },
];

// Mock data for fall analytics
const fallAnalyticsData = [
  { time: "12Am", falls: 1 },
  { time: "3Am", falls: 2 },
  { time: "6Am", falls: 3 },
  { time: "9Am", falls: 2 },
  { time: "12Pm", falls: 1 },
  { time: "3Pm", falls: 2 },
  { time: "6Pm", falls: 5 },
  { time: "9Pm", falls: 2 },
  { time: "12Am", falls: 1 },
];

// Mock video list
const videoList = [
  { id: 1, name: "Video 1", duration: "1:03:45", date: "16-2-2025" },
  { id: 2, name: "Video 2", duration: "0:45:30", date: "16-2-2025" },
  { id: 3, name: "Video 3", duration: "0:30:15", date: "15-2-2025" },
  { id: 4, name: "Video 4", duration: "1:15:20", date: "15-2-2025" },
  { id: 5, name: "Video 5", duration: "0:50:45", date: "14-2-2025" },
];

/* ═══════════════════════ PAGE ═══════════════════════ */
export default function FallsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(0);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [videoProgress, setVideoProgress] = useState(42);
  // eslint-disable-next-line no-unused-vars
  const [currentTime, setCurrentTime] = useState("42:38");
  const { isMobile } = useWindowSize();

  // Calculate max falls for chart scaling
  const maxFalls = Math.max(...fallAnalyticsData.map(d => d.falls));

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
          paddingTop: isMobile ? 80 : 90,
          paddingBottom: isMobile ? 10 : 12,
          height: "100vh",
          boxSizing: "border-box",
        }}
      >
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
            <img src={hospitalIcon} alt="room" style={{ width: 20, height: 20, filter: "brightness(0) invert(1)" }} />
            <span>Room No</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={videoIcon} alt="video" style={{ width: 20, height: 20, filter: "brightness(0) invert(1)" }} />
            <span>Video</span>
          </div>
        </div>

        {/* Table Rows - Scrollable */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", minHeight: 0, flexShrink: 1 }}>
          {fallRecords.map((record) => (
            <div
              key={record.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 16,
                background: "rgba(10, 26, 48, 0.95)",
                border: "2px solid #ffffff",
                borderRadius: 16,
                padding: "16px 24px",
                fontSize: 15,
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={calendarIcon} alt="calendar" style={{ width: 18, height: 18, filter: "brightness(0) invert(1)" }} />
                <span>{record.date}</span>
                <img src={clockIcon} alt="clock" style={{ width: 18, height: 18, filter: "brightness(0) invert(1)", marginLeft: 8 }} />
                <span>{record.time}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%)",
                    border: "2px solid #ffffff",
                  }}
                />
                <span>{record.senior}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={hospitalIcon} alt="room" style={{ width: 18, height: 18, filter: "brightness(0) invert(1)" }} />
                <span>{record.room}</span>
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
                <img src={sendIcon} alt="send" style={{ width: 18, height: 18, filter: "brightness(0) invert(1)" }} />
                <span>Click here</span>
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Section - Analytics and Videos - FIXED HEIGHT NO SCROLL */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 16,
            flex: 1,
            minHeight: 0,
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Fall Analytics</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={threeDotsIcon} alt="options" style={{ width: 24, height: 24, cursor: "pointer", filter: "brightness(0) invert(1)" }} />
                <img src={commentIcon} alt="comment" style={{ width: 24, height: 24, cursor: "pointer", filter: "brightness(0) invert(1)" }} />
                <img src={fullscreenIcon} alt="fullscreen" style={{ width: 24, height: 24, cursor: "pointer", filter: "brightness(0) invert(1)" }} />
              </div>
            </div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>No. Of falls</div>

            {/* Chart */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 12 : 20, flex: 1, paddingTop: 20, minHeight: 0 }}>
              {fallAnalyticsData.map((data, idx) => {
                const barHeight = (data.falls / maxFalls) * 100;
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      height: "100%",
                      justifyContent: "flex-end",
                    }}
                  >
                    {/* Point Icon */}
                    <img
                      src={fallGraphIcon}
                      alt="point"
                      style={{
                        width: 24,
                        height: 24,
                        filter: "brightness(0) invert(1)",
                      }}
                    />
                    {/* Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: `${barHeight}%`,
                        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.5) 100%)",
                        borderRadius: "8px 8px 0 0",
                        position: "relative",
                        minHeight: 40,
                      }}
                    />
                    {/* Time Label */}
                    <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: "nowrap" }}>{data.time}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fall Videos - FIXED HEIGHT WITH SCROLLABLE LIST */}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Fall Videos</h3>
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

            {/* Video Player - FIXED HEIGHT */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.4)",
                borderRadius: 12,
                height: "200px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                flexShrink: 0,
              }}
            >
              {/* Video Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "2px solid #ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  }}
                >
                  <img src={nextIcon} alt="previous" style={{ width: 20, height: 20, transform: "scaleX(-1)", filter: "brightness(0) invert(1)" }} />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "2px solid #ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  }}
                >
                  {isPlaying ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill={W}>
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill={W}>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <button
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "2px solid #ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  }}
                >
                  <img src={nextIcon} alt="next" style={{ width: 20, height: 20, filter: "brightness(0) invert(1)" }} />
                </button>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 16,
                  right: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 6,
                    background: "rgba(255, 255, 255, 0.2)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${videoProgress}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #ff6b6b 0%, #ee5a6f 100%)",
                      borderRadius: 3,
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, textAlign: "right" }}>
                  {currentTime} / {videoList[currentVideo].duration}
                </div>
              </div>
            </div>

            {/* Video List - SCROLLABLE with Date */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, overflowY: "auto", minHeight: 0 }}>
              {videoList.map((video, idx) => (
                <button
                  key={video.id}
                  onClick={() => setCurrentVideo(idx)}
                  style={{
                    padding: "12px 16px",
                    background: currentVideo === idx ? "rgba(74, 144, 226, 0.3)" : "rgba(255, 255, 255, 0.05)",
                    border: currentVideo === idx ? "2px solid rgba(74, 144, 226, 0.8)" : "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: 10,
                    color: W,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (currentVideo !== idx) e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    if (currentVideo !== idx) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    <span style={{ fontWeight: currentVideo === idx ? 700 : 400 }}>{video.name}</span>
                    <span style={{ fontSize: 12, opacity: 0.6 }}>Date: {video.date}</span>
                  </div>
                  <span style={{ opacity: 0.6 }}>{video.duration}</span>
                </button>
              ))}
            </div>
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
                {videoList[currentVideo].name} - Full Screen
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
            <div
              style={{
                background: "rgba(0, 0, 0, 0.6)",
                borderRadius: 12,
                aspectRatio: "16/9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {/* Video Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <button
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "3px solid #ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  }}
                >
                  <img src={nextIcon} alt="previous" style={{ width: 28, height: 28, transform: "scaleX(-1)", filter: "brightness(0) invert(1)" }} />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "3px solid #ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  }}
                >
                  {isPlaying ? (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill={W}>
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill={W}>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <button
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "3px solid #ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  }}
                >
                  <img src={nextIcon} alt="next" style={{ width: 28, height: 28, filter: "brightness(0) invert(1)" }} />
                </button>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  position: "absolute",
                  bottom: 24,
                  left: 24,
                  right: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    background: "rgba(255, 255, 255, 0.2)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${videoProgress}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #ff6b6b 0%, #ee5a6f 100%)",
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div style={{ fontSize: 14, opacity: 0.8, textAlign: "right", color: W }}>
                  {currentTime} / {videoList[currentVideo].duration}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
