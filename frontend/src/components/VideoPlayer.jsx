import { useEffect, useRef, useState } from 'react';

const W = "#ffffff";

export default function VideoPlayer({ videoUrl, fallInfo, onClose }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / video.duration) * 100 || 0);
    };

    const updateDuration = () => {
      setDuration(video.duration);
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [videoUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    video.currentTime = pos * video.duration;
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
      {/* Video Player */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.9)",
          borderRadius: 12,
          flex: "0 0 55%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Video Controls Overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
            padding: "20px 16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Progress Bar */}
          <div
            onClick={handleSeek}
            style={{
              width: "100%",
              height: 6,
              background: "rgba(255, 255, 255, 0.3)",
              borderRadius: 3,
              cursor: "pointer",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #ff6b6b 0%, #ee5a6f 100%)",
                borderRadius: 3,
              }}
            />
          </div>

          {/* Play Button and Time */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={togglePlay}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.2)",
                border: "2px solid rgba(255, 255, 255, 0.5)",
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill={W}>
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill={W}>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <div style={{ fontSize: 13, color: W, fontWeight: 500 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>
      </div>

      {/* Video Info - Right side */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0, overflowY: "auto" }}>
        {fallInfo ? (
          <div
            style={{
              padding: "16px",
              background: "rgba(74, 144, 226, 0.2)",
              border: "2px solid rgba(74, 144, 226, 0.5)",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>Fall Incident Video Clip</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              <div>📹 Duration: {formatTime(duration)}</div>
              <div>📍 Location: {fallInfo.location_detail || 'N/A'}</div>
              <div>⚠️ Severity: {fallInfo.severity}</div>
              <div>
                🎯 Confidence: {fallInfo.confidence_score ? `${(fallInfo.confidence_score * 100).toFixed(0)}%` : 'N/A'}
              </div>
            </div>
            <div
              style={{
                marginTop: 8,
                padding: 8,
                background: "rgba(0, 0, 0, 0.3)",
                borderRadius: 6,
                fontSize: 12,
                opacity: 0.8,
              }}
            >
              💡 Video clip captured by AI fall detection system
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
              opacity: 0.6,
              flex: 1,
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={W} strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
            <p style={{ fontSize: 14, margin: "12px 0 0 0", textAlign: "center" }}>
              Click on a fall incident to view video (if available)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
