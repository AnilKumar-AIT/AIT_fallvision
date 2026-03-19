/**
 * Loading Spinner Component
 */
export default function LoadingSpinner({ message = "Loading data..." }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "400px",
      gap: 20,
      color: "#ffffff"
    }}>
      <div style={{
        width: 60,
        height: 60,
        border: "4px solid rgba(255,255,255,0.1)",
        borderTop: "4px solid #ffffff",
        borderRadius: "50%",
        animation: "spin 1s linear infinite"
      }}/>
      <p style={{ fontSize: 16, opacity: 0.7 }}>{message}</p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
