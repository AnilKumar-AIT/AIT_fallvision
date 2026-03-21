/**
 * API Service Layer
 * Handles all backend API calls
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

class ApiService {
  /**
   * Generic fetch wrapper with error handling
   */
  async fetchData(endpoint) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  /**
   * SLEEP DIARY API
   */
  async getSleepData(residentId) {
    return this.fetchData(`/sleep/${encodeURIComponent(residentId)}`);
  }

  async getSleepSummary(residentId, days = 7) {
    return this.fetchData(`/sleep/${encodeURIComponent(residentId)}/summary?days=${days}`);
  }

  /**
   * GAIT ANALYSIS API
   */
  async getGaitData(residentId) {
    return this.fetchData(`/gait/${encodeURIComponent(residentId)}`);
  }

  async getGaitMetrics(residentId) {
    return this.fetchData(`/gait/${encodeURIComponent(residentId)}/metrics`);
  }

  /**
   * RESIDENTS API
   */
  async getAllResidents() {
    return this.fetchData('/residents');
  }

  async getResident(residentId) {
    return this.fetchData(`/residents/${encodeURIComponent(residentId)}`);
  }

  async getResidentAlerts(residentId, limit = 10) {
    return this.fetchData(`/residents/${encodeURIComponent(residentId)}/alerts?limit=${limit}`);
  }

  async getResidentSuggestions(residentId, limit = 10) {
    return this.fetchData(`/residents/${encodeURIComponent(residentId)}/suggestions?limit=${limit}`);
  }

  async getHealthScore(residentId) {
    return this.fetchData(`/residents/${encodeURIComponent(residentId)}/health-score`);
  }

  /**
   * RESIDENT DETAILS API
   */
  async getResidentDetails(residentId) {
    const data = await this.fetchData(`/residents/${encodeURIComponent(residentId)}`);
    
    // Extract name from status_name_sort field: "ACTIVE#LastName#FirstName#RES#..."
    let displayName = 'Unknown Resident';
    if (data.status_name_sort) {
      const parts = data.status_name_sort.split('#');
      if (parts.length >= 3) {
        const lastName = parts[1] || '';
        const firstName = parts[2] || '';
        displayName = `${firstName} ${lastName}`.trim();
      }
    }
    
    // Construct S3 photo URL if photo_s3_key exists
    let profilePhoto = null;
    if (data.photo_s3_key) {
      // Main dashboard photos bucket
      const bucketName = 'aitcare-dashboard-photos-dev';
      const region = 'us-east-1';
      profilePhoto = `https://${bucketName}.s3.${region}.amazonaws.com/${data.photo_s3_key}`;
    }
    
    // Add the extracted name and photo URL to the data
    return {
      ...data,
      name: displayName,
      profile_photo: profilePhoto,
      room_id: (data.room_id || '').replace('ROOM#r-', '') || 'N/A'
    };
  }

  async getEmergencyContacts(residentId) {
    // Mock data for now - will be replaced with real API endpoint
    return [
      {
        contact_name: "John Doe",
        contact_priority: "PRIMARY",
        relationship: "Son",
        phone: "(555) 123-4567",
        email: "john.doe@email.com",
        notify_on_fall: true,
        is_legal_guardian: true
      },
      {
        contact_name: "Jane Smith",
        contact_priority: "SECONDARY",
        relationship: "Daughter",
        phone: "(555) 987-6543",
        email: "jane.smith@email.com",
        notify_on_fall: true,
        is_legal_guardian: false
      }
    ];
  }

  async getResidentHighlights(residentId) {
    // Mock data for now - will be replaced with real API endpoint
    return {
      last_sleep_hours: 7.5,
      last_sleep_date: "2025-03-13",
      recent_falls_count: 2,
      gait_score: 72,
      adl_completion: 85
    };
  }

  /**
   * CAREGIVERS API
   */
  async getAllCaregivers() {
    return this.fetchData('/caregivers');
  }

  async getCaregiver(caregiverId) {
    return this.fetchData(`/caregivers/${encodeURIComponent(caregiverId)}`);
  }

  async getCaregiverCertifications(caregiverId) {
    try {
      const data = await this.fetchData(`/caregivers/${encodeURIComponent(caregiverId)}/certifications`);
      
      // If we got certifications, calculate days_until_expiry
      if (data && data.certifications && data.certifications.length > 0) {
        const processedCerts = data.certifications.map(cert => {
          let daysUntilExpiry = null;
          if (cert.expiry_date) {
            const expiryDate = new Date(cert.expiry_date);
            const today = new Date();
            daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
          }
          
          return {
            ...cert,
            days_until_expiry: daysUntilExpiry
          };
        });
        
        return {
          certifications: processedCerts
        };
      }
      
      // No certifications found - return empty
      return {
        certifications: []
      };
    } catch (error) {
      console.error('Error fetching certifications:', error);
      throw error;
    }
  }

  async getCaregiverAssignments(caregiverId, days = 7) {
    return this.fetchData(`/caregivers/${encodeURIComponent(caregiverId)}/assignments?days=${days}`);
  }

  async getCaregiverSchedule(caregiverId, days = 7) {
    return this.fetchData(`/caregivers/${encodeURIComponent(caregiverId)}/schedule?days=${days}`);
  }

  async getCaregiverPerformance(caregiverId) {
    try {
      const data = await this.fetchData(`/caregivers/${encodeURIComponent(caregiverId)}/performance`);
      
      // Return data as is from backend
      return data;
    } catch (error) {
      console.error('Error fetching performance:', error);
      throw error;
    }
  }

  /**
   * CAREGIVER DETAILS (processed)
   */
  async getCaregiverDetails(caregiverId) {
    const data = await this.fetchData(`/caregivers/${encodeURIComponent(caregiverId)}`);
    
    // Extract display name
    let displayName = data.display_name || 'Unknown Caregiver';
    
    // Construct profile photo URL if available
    let profilePhoto = null;
    if (data.photo_s3_key) {
      // Main dashboard photos bucket
      const bucketName = 'aitcare-dashboard-photos-dev';
      const region = 'us-east-1';
      profilePhoto = `https://${bucketName}.s3.${region}.amazonaws.com/${data.photo_s3_key}`;
    }
    
    return {
      ...data,
      name: displayName,
      profile_photo: profilePhoto
    };
  }
}

// Export singleton instance
const apiService = new ApiService();
export default apiService;
