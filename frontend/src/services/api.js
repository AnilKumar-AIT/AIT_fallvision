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
}

// Export singleton instance
const apiService = new ApiService();
export default apiService;
