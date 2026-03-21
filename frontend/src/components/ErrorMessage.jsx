/**
 * Error Display Component
 */
export default function ErrorMessage({ error, onRetry, residentId }) {
  const errorDetails = error?.response?.data?.detail || error?.message || "Unknown error occurred";
  
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "400px",
      gap: 20,
      padding: 40,
      textAlign: "center"
    }}>
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      
      <div>
        <h2 style={{ color: "#ff4444", marginBottom: 10, fontSize: 24 }}>
          Error Loading Data
        </h2>
        <p style={{ color: "#ffffff", opacity: 0.7, fontSize: 14, maxWidth: 500, marginBottom: 10 }}>
          {errorDetails}
        </p>
        {residentId && (
          <p style={{ color: "#ffffff", opacity: 0.5, fontSize: 12 }}>
            Resident ID: {residentId}
          </p>
        )}
      </div>
      
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "12px 30px",
            fontSize: 16,
            fontWeight: 600,
            color: "#ffffff",
            background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            transition: "transform 0.2s"
          }}
          onMouseOver={e => e.target.style.transform = "scale(1.05)"}
          onMouseOut={e => e.target.style.transform = "scale(1)"}
        >
          Retry
        </button>
      )}
      
      <p style={{ color: "#ffffff", opacity: 0.5, fontSize: 12, marginTop: 20 }}>
        Make sure the backend server is running at http://localhost:8000
      </p>
    </div>
  );
}
