import { useState }        from "react";
import LoginPage           from "./LoginPage";
import ForgotPasswordPage  from "./ForgotPasswordPage";
import Sidebar             from "../components/Sidebar";
import SleepDiaryPage      from "./SleepDiaryPage";
import GaitPage            from "./GaitPage";
import ADLSPage            from "./ADLSPage";
import SeniorsPage         from "./SeniorsPage";
import ResidentDetailsPage from "./ResidentDetailsPage";
import CaregiversPage      from "./CaregiversPage";
import CaregiverDetailsPage from "./CaregiverDetailsPage";
import AddSeniorPage from "./AddSeniorPage";
import AddCaregiverPage from "./AddCaregiverPage";
import EditCaregiverModal from "../components/EditCaregiverModal";
import EditResidentModal from "../components/EditResidentModal";
import FallsPage from "./FallsPage";

const PAGE_MAP = {
  "Falls":<FallsPage/>,
  "Sleep Diary": <SleepDiaryPage />,
  "Gait":        <GaitPage />,
  "ADLs":        <ADLSPage />,
  "Seniors":     <SeniorsPage />,
  "Caregivers":  <CaregiversPage />,
};

/* ── Background per page ── */
const PAGE_BG = {
  "Sleep Diary": "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
  "Gait":        "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
  "ADLs":        "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
  "Seniors":     "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
  "Caregivers":  "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
  "Falls":       "linear-gradient(160deg, #b8d4f0 0%, #9ec4ea 30%, #7daed8 60%, #6a9ccc 100%)",
};

const ComingSoon = ({ name }) => (
  <main style={{
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 16,
  }}>
    <div style={{
      width: 64, height: 64, borderRadius: 16,
      background: "rgba(26,120,200,0.15)",
      border: "1px solid rgba(26,120,200,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
           stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <path d="M9 9h6M9 12h6M9 15h4"/>
      </svg>
    </div>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{name}</p>
    <p style={{ margin: 0, fontSize: 14, opacity: 0.35 }}>
      This page is coming soon
    </p>
  </main>
);

export default function Dashboard() {
  const [user, setUser]             = useState(null);
  const [authScreen, setAuthScreen] = useState("login"); // "login" | "forgot"
  const [activePage, setActivePage] = useState("Sleep Diary");
    const [seniorsFilters, setSeniorsFilters] = useState(null);
  const [caregiversFilters, setCaregiversFilters] = useState(null);
  const [fallsFilters, setFallsFilters] = useState(null);
  const [selectedResident, setSelectedResident] = useState(null);
    const [selectedCaregiver, setSelectedCaregiver] = useState(null);
    const [residentPageContext, setResidentPageContext] = useState(null); // Tracks which resident's page to show
  const [isInResidentContext, setIsInResidentContext] = useState(false); // Lock navigation when viewing resident-specific pages
      const [showAddSenior, setShowAddSenior] = useState(false); // Show Add Senior page
  const [showAddCaregiver, setShowAddCaregiver] = useState(false); // Show Add Caregiver page
  const [editingCaregiver, setEditingCaregiver] = useState(null); // Caregiver being edited
  const [editingResident, setEditingResident] = useState(null); // Resident being edited

  /* ── Not logged in → show auth screens ── */
  if (!user) {
    if (authScreen === "forgot") {
      return <ForgotPasswordPage onBackToLogin={() => setAuthScreen("login")} />;
    }
    return (
      <LoginPage
        onLogin={(u) => setUser(u)}
        onForgotPassword={() => setAuthScreen("forgot")}
      />
    );
  }

                        /* ── Logged in → show Dashboard ── */
  // If Add Caregiver page is open, show it
  if (showAddCaregiver) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: PAGE_BG["Caregivers"] || "#060c16",
        fontFamily: "'Segoe UI', sans-serif",
        color: "#ffffff",
        overflow: "hidden",
        transition: "background 0.3s ease, color 0.3s ease",
        position: "relative",
      }}>
        <Sidebar 
          activePage="Caregivers" 
          onNavigate={(page) => {
            setShowAddCaregiver(false);
            setActivePage(page);
          }}
          seniorsFilters={null}
          caregiversFilters={null}
        />
        <AddCaregiverPage 
          onBack={() => setShowAddCaregiver(false)}
          onCaregiverAdded={(newCaregiver) => {
            
            // Will go back to caregivers page which will reload
          }}
        />
      </div>
    );
  }

  // If Add Senior page is open, show it
  if (showAddSenior) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: PAGE_BG["Seniors"] || "#060c16",
        fontFamily: "'Segoe UI', sans-serif",
        color: "#ffffff",
        overflow: "hidden",
        transition: "background 0.3s ease, color 0.3s ease",
        position: "relative",
      }}>
        <Sidebar 
          activePage="Seniors" 
          onNavigate={(page) => {
            setShowAddSenior(false);
            setActivePage(page);
          }}
          seniorsFilters={null}
          caregiversFilters={null}
        />
        <AddSeniorPage 
          onBack={() => setShowAddSenior(false)}
          onSeniorAdded={(newResident) => {
            
            // Will go back to seniors page which will reload
          }}
        />
      </div>
    );
  }

  // If a caregiver is selected, show the caregiver details page
  if (selectedCaregiver) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: PAGE_BG[activePage] || "#060c16",
        fontFamily: "'Segoe UI', sans-serif",
        color: "#ffffff",
        overflow: "hidden",
        transition: "background 0.3s ease, color 0.3s ease",
        position: "relative",
      }}>
        <Sidebar 
          activePage={activePage} 
          onNavigate={setActivePage}
          seniorsFilters={activePage === "Seniors" ? seniorsFilters : null}
          caregiversFilters={activePage === "Caregivers" ? caregiversFilters : null}
        />
                <CaregiverDetailsPage 
          caregiverId={selectedCaregiver} 
          onBack={() => setSelectedCaregiver(null)}
          onNavigateToScreen={(screen, data) => {
            // Handle navigation from caregiver details
            if (screen === 'resident-details') {
              // Navigate to resident details page
              setSelectedCaregiver(null);
              setSelectedResident(data); // data is the resident ID
            } else {
              setSelectedCaregiver(null);
              setActivePage(screen);
            }
          }}
        />
      </div>
    );
  }
  
  // If a resident is selected, show the details page
  if (selectedResident) {
    return (
            <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: PAGE_BG[activePage] || "#060c16",
        fontFamily: "'Segoe UI', sans-serif",
        color: "#ffffff",
        overflow: "hidden",
        transition: "background 0.3s ease, color 0.3s ease",
        position: "relative",
      }}>
        <Sidebar 
          activePage={activePage} 
          onNavigate={setActivePage}
          seniorsFilters={activePage === "Seniors" ? seniorsFilters : null}
          caregiversFilters={activePage === "Caregivers" ? caregiversFilters : null}
        />
                                <ResidentDetailsPage 
          residentId={selectedResident} 
          onBack={() => {
            setSelectedResident(null);
            setIsInResidentContext(false);
            setResidentPageContext(null);
          }}
          onNavigateToScreen={(screen, residentId) => {
            // When clicking arrow on resident details, navigate with context lock
            setSelectedResident(null);
            setActivePage(screen);
            setResidentPageContext(residentId);
            setIsInResidentContext(true); // Lock navigation
          }}
        />
      </div>
    );
  }
  
                        // Render current page based on activePage
  let CurrentPage;
  
  // Function to go back to resident details from context pages
  const handleBackToResidentDetails = () => {
    const resId = residentPageContext;
    setResidentPageContext(null);
    setIsInResidentContext(false);
    setSelectedResident(resId); // Show the resident details page again
  };
  
        if (activePage === "Sleep Diary") {
    CurrentPage = <SleepDiaryPage 
      residentId={residentPageContext} 
      showBackButton={isInResidentContext}
      onBackToResident={handleBackToResidentDetails}
    />;
  } else if (activePage === "Gait") {
    CurrentPage = <GaitPage 
      residentId={residentPageContext}
      showBackButton={isInResidentContext}
      onBackToResident={handleBackToResidentDetails}
    />;
    } else if (activePage === "ADLs") {
    CurrentPage = <ADLSPage 
      residentId={residentPageContext}
      showBackButton={isInResidentContext}
      onBackToResident={handleBackToResidentDetails}
    />;
  } else if (activePage === "Falls") {
    CurrentPage = <FallsPage 
      onFiltersChange={setFallsFilters}
      residentId={residentPageContext}
      showBackButton={isInResidentContext}
      onBackToResident={handleBackToResidentDetails}
    />;
  } else if (activePage === "Seniors") {
                CurrentPage = <SeniorsPage 
      onFiltersChange={setSeniorsFilters} 
      onResidentClick={(residentId) => setSelectedResident(residentId)}
      onAddSenior={() => setShowAddSenior(true)}
      onEditResident={(resident) => setEditingResident(resident)}
    />;
            } else if (activePage === "Caregivers") {
    CurrentPage = <CaregiversPage 
      onFiltersChange={setCaregiversFilters} 
      onCaregiverClick={(caregiverId) => setSelectedCaregiver(caregiverId)}
      onAddCaregiver={() => setShowAddCaregiver(true)}
      onEditCaregiver={(caregiver) => setEditingCaregiver(caregiver)}
    />;
  } else if (PAGE_MAP[activePage]) {
    CurrentPage = PAGE_MAP[activePage];
  } else {
    CurrentPage = <ComingSoon name={activePage} />;
  }
    const bg = PAGE_BG[activePage] || "#060c16";
  const textColor = "#ffffff";

    return (
        <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: bg,
      fontFamily: "'Segoe UI', sans-serif",
      color: textColor,
      overflow: "hidden",
      transition: "background 0.3s ease, color 0.3s ease",
      position: "relative",
    }}>
                  <Sidebar 
        activePage={activePage} 
                onNavigate={(page) => {
          // Block navigation when in resident context mode (except Seniors)
          if (isInResidentContext && page !== "Seniors") {
            return; // Do nothing
          }
          // Clear resident context when navigating to Seniors
          if (page === "Seniors" && (residentPageContext || isInResidentContext)) {
            setResidentPageContext(null);
            setIsInResidentContext(false);
          }
          setActivePage(page);
        }}
                seniorsFilters={activePage === "Seniors" ? seniorsFilters : null}
        caregiversFilters={activePage === "Caregivers" ? caregiversFilters : null}
        fallsFilters={activePage === "Falls" ? fallsFilters : null}
        isNavigationLocked={isInResidentContext}
      />
      
                        {CurrentPage}
      
      {/* Edit Caregiver Modal */}
      {editingCaregiver && (
        <EditCaregiverModal
          caregiver={editingCaregiver}
          onClose={() => setEditingCaregiver(null)}
          onUpdate={(updatedCaregiver) => {
            
            setEditingCaregiver(null);
            // The CaregiversPage will reload on mount to show updated data
          }}
          isMobile={false}
        />
      )}
      
      {/* Edit Resident Modal */}
      {editingResident && (
        <EditResidentModal
          resident={editingResident}
          onClose={() => setEditingResident(null)}
          onUpdate={(updatedResident) => {
            
            setEditingResident(null);
            // The SeniorsPage will reload on mount to show updated data
          }}
          isMobile={false}
        />
      )}
    </div>
  );
}
