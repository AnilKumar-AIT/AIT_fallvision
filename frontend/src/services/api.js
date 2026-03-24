/**
 * API Service Layer
 * Handles all backend API calls
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
const S3_BUCKET = 'aitcare-dashboard-photos-dev';
const S3_REGION = 'us-east-1';

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
   * ADLs (Activities of Daily Living) API
   */
  async getADLSData(residentId) {
    return this.fetchData(`/adls/${encodeURIComponent(residentId)}`);
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
   * DELETE RESIDENT (also deletes photo from S3 on backend)
   */
  async deleteResident(residentId) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/residents/${encodeURIComponent(residentId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API Error [DELETE /residents]:', error);
      throw error;
    }
  }

  /**
   * CREATE RESIDENT (multipart form with optional photo)
   */
  async createResident(residentData, photoFile = null) {
    try {
      const formData = new FormData();
      formData.append('resident_data', JSON.stringify(residentData));
      
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      
      const response = await fetch(`${API_BASE_URL}/residents`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary for multipart
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error [POST /residents]:', error);
      throw error;
    }
  }

  /**
   * UPDATE RESIDENT
   */
  async updateResident(residentId, residentData) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/residents/${encodeURIComponent(residentId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(residentData),
        }
      );
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error [PUT /residents]:', error);
      throw error;
    }
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
    
    // Construct S3 photo URL if photo_s3_key exists and is not empty
    let profilePhoto = null;
    if (data.photo_s3_key && data.photo_s3_key.length > 0) {
      profilePhoto = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${data.photo_s3_key}`;
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
    try {
      const data = await this.fetchData(`/residents/${encodeURIComponent(residentId)}/emergency-contacts`);
      return data.contacts || [];
    } catch (error) {
      console.error('Error fetching emergency contacts:', error);
      return [];
    }
  }

  async getResidentCaregivers(residentId, days = 7) {
    return this.fetchData(`/residents/${encodeURIComponent(residentId)}/caregivers?days=${days}`);
  }

  async getResidentHighlights(residentId) {
    // Pull real data from health-score, sleep summary, and gait snapshot
    const highlights = {
      last_sleep_hours: null,
      last_sleep_date: null,
      recent_falls_count: null,
      gait_score: null,
      adl_completion: null
    };

    try {
      const healthScore = await this.getHealthScore(residentId);
      if (healthScore) {
        highlights.gait_score = healthScore.gait_stability_score || null;
        highlights.recent_falls_count = healthScore.fall_card?.line1 ? 
          parseInt(healthScore.fall_card.line1) || 0 : 0;
        highlights.adl_completion = healthScore.activity_level_score || null;
        
        if (healthScore.sleep_card?.line1) {
          const sleepHrs = parseFloat(healthScore.sleep_card.line1);
          if (!isNaN(sleepHrs)) highlights.last_sleep_hours = sleepHrs;
        }
      }
    } catch (e) {
      console.warn('Could not load health score for highlights:', e);
    }

    try {
      const sleepData = await this.fetchData(`/sleep/${encodeURIComponent(residentId)}/summary?days=1`);
      if (sleepData && sleepData.length > 0) {
        const latest = sleepData[0];
        const tst = latest.total_sleep_time_min;
        if (tst) highlights.last_sleep_hours = Math.round((tst / 60) * 10) / 10;
        if (latest.sleep_date) highlights.last_sleep_date = latest.sleep_date;
      }
    } catch (e) {
      console.warn('Could not load sleep summary for highlights:', e);
    }

    return highlights;
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
   * CREATE CAREGIVER (multipart form with optional photo)
   */
  async createCaregiver(caregiverData, photoFile = null) {
    try {
      const formData = new FormData();
      formData.append('caregiver_data', JSON.stringify(caregiverData));
      
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      
      const response = await fetch(`${API_BASE_URL}/caregivers`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary for multipart
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error [POST /caregivers]:', error);
      throw error;
    }
  }

  /**
   * UPDATE CAREGIVER
   */
  async updateCaregiver(caregiverId, caregiverData) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/caregivers/${encodeURIComponent(caregiverId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(caregiverData),
        }
      );
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error [PUT /caregivers]:', error);
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
      profilePhoto = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${data.photo_s3_key}`;
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
