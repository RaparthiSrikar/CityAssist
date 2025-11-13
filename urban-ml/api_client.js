/**
 * Frontend API Client for Urban ML Backend
 * Use this in your React, Vue, or vanilla JavaScript frontend
 */

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

/**
 * Check backend health status
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  } catch (error) {
    console.error("Health check failed:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * Get available models
 */
export async function getModels() {
  try {
    const res = await fetch(`${API_BASE}/models`);
    return res.json();
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return { models: {} };
  }
}

/**
 * Get personalization alert based on user profile and AQI
 * @param {Object} userData - User data object
 * @param {string} userData.user_id - User ID
 * @param {number} userData.age - User age
 * @param {number} userData.aqi - Air Quality Index (0-500)
 * @param {number} userData.sensitivity - Sensitivity multiplier (default 1.0)
 * @param {Array<string>} userData.chronic_conditions - List of chronic conditions
 * @returns {Promise<Object>} - Alert response with send_alert, severity, reason
 */
export async function getPersonalizationAlert(userData) {
  try {
    const res = await fetch(`${API_BASE}/predict/personalization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userData.user_id || null,
        age: userData.age || null,
        aqi: userData.aqi || 0,
        sensitivity: userData.sensitivity || 1.0,
        chronic_conditions: userData.chronic_conditions || []
      })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || "Personalization prediction failed");
    }
    return res.json();
  } catch (error) {
    console.error("Personalization API error:", error);
    return { 
      send_alert: false, 
      severity: "error", 
      reason: error.message 
    };
  }
}

/**
 * Get route recommendation
 * @param {Object} routeData - Route request data
 * @param {string} routeData.origin - Starting location
 * @param {string} routeData.destination - Destination location
 * @param {number} routeData.traffic_level - Traffic level (0.0-1.0)
 * @param {Object} routeData.user_prefs - User preferences (e.g., avoid_highways, prefer_bus_lanes)
 * @param {Array<Object>} routeData.incidents - List of incidents
 * @returns {Promise<Object>} - Route response with recommended_route, eta_minutes, reason
 */
export async function getRoute(routeData) {
  try {
    const res = await fetch(`${API_BASE}/predict/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: routeData.origin || "",
        destination: routeData.destination || "",
        traffic_level: routeData.traffic_level || 0.5,
        user_prefs: routeData.user_prefs || {},
        incidents: routeData.incidents || []
      })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || "Route prediction failed");
    }
    return res.json();
  } catch (error) {
    console.error("Route API error:", error);
    return { 
      recommended_route: [], 
      eta_minutes: 0, 
      reason: error.message 
    };
  }
}

/**
 * Get outage ETA prediction
 * @param {Object} outageData - Outage request data
 * @param {Date} outageData.outage_start - When outage started
 * @param {number} outageData.affected_customers - Number of affected customers
 * @param {number} outageData.weather_severity - Weather severity (0.0-1.0)
 * @param {number} outageData.grid_load - Grid load percentage (0.0-1.0)
 * @returns {Promise<Object>} - Outage response with eta_minutes, confidence, reason
 */
export async function predictOutageETA(outageData) {
  try {
    const res = await fetch(`${API_BASE}/predict/outage_eta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outage_start: outageData.outage_start || null,
        affected_customers: outageData.affected_customers || 0,
        weather_severity: outageData.weather_severity || 0.0,
        grid_load: outageData.grid_load || 0.5
      })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || "Outage prediction failed");
    }
    return res.json();
  } catch (error) {
    console.error("Outage API error:", error);
    return { 
      eta_minutes: 0, 
      confidence: 0, 
      reason: error.message 
    };
  }
}

/**
 * Triage image for street issues (pothole, tree fall, garbage, etc.)
 * @param {File} file - Image file to analyze
 * @returns {Promise<Object>} - Triage response with label, priority, reason
 */
export async function triageImage(file) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    
    const res = await fetch(`${API_BASE}/predict/image_triage`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || "Image triage failed");
    }
    return res.json();
  } catch (error) {
    console.error("Image triage API error:", error);
    return { 
      label: "error", 
      priority: "unknown", 
      reason: error.message 
    };
  }
}

/**
 * Batch operation: Check multiple predictions at once
 * @param {Object} batchData - Data for all predictions
 * @returns {Promise<Object>} - Object with results from all predictions
 */
export async function batchPredict(batchData) {
  const results = {};
  
  if (batchData.personalization) {
    results.personalization = await getPersonalizationAlert(batchData.personalization);
  }
  
  if (batchData.route) {
    results.route = await getRoute(batchData.route);
  }
  
  if (batchData.outage) {
    results.outage = await predictOutageETA(batchData.outage);
  }
  
  if (batchData.image) {
    results.image = await triageImage(batchData.image);
  }
  
  return results;
}

export default {
  checkHealth,
  getModels,
  getPersonalizationAlert,
  getRoute,
  predictOutageETA,
  triageImage,
  batchPredict
};
