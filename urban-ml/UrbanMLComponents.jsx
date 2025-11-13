/**
 * Example React Component for Urban ML Integration
 * Shows how to use the API client in a React application
 */

import React, { useState, useEffect } from 'react';
import * as UrbanMLAPI from './api_client';

export function UrbanMLDashboard() {
  const [health, setHealth] = useState(null);
  const [models, setModels] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load health and models on component mount
  useEffect(() => {
    async function loadBackendInfo() {
      try {
        const healthData = await UrbanMLAPI.checkHealth();
        const modelsData = await UrbanMLAPI.getModels();
        setHealth(healthData);
        setModels(modelsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadBackendInfo();
  }, []);

  if (loading) return <div>Loading backend status...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="dashboard">
      <h1>Urban ML Dashboard</h1>
      
      {health && (
        <section className="health-status">
          <h2>Backend Status</h2>
          <p>Status: <strong>{health.status}</strong></p>
          <p>Version: {health.version}</p>
          <p>Redis: {health.redis_status}</p>
          <div className="models">
            <h3>Models Loaded:</h3>
            <ul>
              <li>Personalization: {health.models_loaded.personalization ? '✓' : '✗'}</li>
              <li>Route Model: {health.models_loaded.route_model ? '✓' : '✗'}</li>
              <li>Outage ETA: {health.models_loaded.outage_eta ? '✓' : '✗'}</li>
              <li>Image Triage: {health.models_loaded.image_triage ? '✓' : '✗'}</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Component for Air Quality Personalization
 */
export function PersonalizationComponent() {
  const [formData, setFormData] = useState({
    user_id: '',
    age: 40,
    aqi: 100,
    sensitivity: 1.0,
    chronic_conditions: []
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await UrbanMLAPI.getPersonalizationAlert(formData);
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="personalization-component">
      <h2>Air Quality Alert</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="User ID"
          value={formData.user_id}
          onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
        />
        <input
          type="number"
          placeholder="Age"
          value={formData.age}
          onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
        />
        <input
          type="number"
          placeholder="AQI (0-500)"
          value={formData.aqi}
          onChange={(e) => setFormData({ ...formData, aqi: parseFloat(e.target.value) })}
          min="0"
          max="500"
        />
        <input
          type="number"
          placeholder="Sensitivity (1.0)"
          value={formData.sensitivity}
          onChange={(e) => setFormData({ ...formData, sensitivity: parseFloat(e.target.value) })}
          step="0.1"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Predicting...' : 'Get Alert'}
        </button>
      </form>
      
      {result && (
        <div className="result">
          <h3>Alert Result:</h3>
          <p><strong>Send Alert:</strong> {result.send_alert ? 'Yes' : 'No'}</p>
          <p><strong>Severity:</strong> {result.severity}</p>
          <p><strong>Reason:</strong> {result.reason}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Component for Route Recommendations
 */
export function RouteComponent() {
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    traffic_level: 0.5,
    user_prefs: { avoid_highways: false, prefer_bus_lanes: false }
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await UrbanMLAPI.getRoute(formData);
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="route-component">
      <h2>Route Recommendation</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Origin"
          value={formData.origin}
          onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
        />
        <input
          type="text"
          placeholder="Destination"
          value={formData.destination}
          onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
        />
        <input
          type="number"
          placeholder="Traffic Level (0-1)"
          value={formData.traffic_level}
          onChange={(e) => setFormData({ ...formData, traffic_level: parseFloat(e.target.value) })}
          min="0"
          max="1"
          step="0.1"
        />
        <label>
          <input
            type="checkbox"
            checked={formData.user_prefs.avoid_highways}
            onChange={(e) => setFormData({
              ...formData,
              user_prefs: { ...formData.user_prefs, avoid_highways: e.target.checked }
            })}
          />
          Avoid Highways
        </label>
        <label>
          <input
            type="checkbox"
            checked={formData.user_prefs.prefer_bus_lanes}
            onChange={(e) => setFormData({
              ...formData,
              user_prefs: { ...formData.user_prefs, prefer_bus_lanes: e.target.checked }
            })}
          />
          Prefer Bus Lanes
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Finding Route...' : 'Get Route'}
        </button>
      </form>

      {result && (
        <div className="result">
          <h3>Route Result:</h3>
          <p><strong>Recommended Route:</strong> {result.recommended_route.join(' → ')}</p>
          <p><strong>ETA:</strong> {result.eta_minutes} minutes</p>
          <p><strong>Reason:</strong> {result.reason}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Component for Image Triage
 */
export function ImageTriageComponent() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    
    setLoading(true);
    try {
      const response = await UrbanMLAPI.triageImage(file);
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="image-triage-component">
      <h2>Image Triage</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={loading}
        />
        {preview && <img src={preview} alt="Preview" style={{ maxWidth: '200px' }} />}
        <button type="submit" disabled={loading || !file}>
          {loading ? 'Analyzing...' : 'Analyze Image'}
        </button>
      </form>

      {result && (
        <div className="result">
          <h3>Triage Result:</h3>
          <p><strong>Label:</strong> {result.label}</p>
          <p><strong>Priority:</strong> <span className={`priority-${result.priority}`}>{result.priority}</span></p>
          <p><strong>Reason:</strong> {result.reason}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Outage Prediction Component
 */
export function OutageComponent() {
  const [formData, setFormData] = useState({
    outage_start: new Date().toISOString().slice(0, 16),
    affected_customers: 100,
    weather_severity: 0.5,
    grid_load: 0.5
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await UrbanMLAPI.predictOutageETA(formData);
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="outage-component">
      <h2>Outage Prediction</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="datetime-local"
          value={formData.outage_start}
          onChange={(e) => setFormData({ ...formData, outage_start: e.target.value })}
        />
        <input
          type="number"
          placeholder="Affected Customers"
          value={formData.affected_customers}
          onChange={(e) => setFormData({ ...formData, affected_customers: parseInt(e.target.value) })}
        />
        <input
          type="number"
          placeholder="Weather Severity (0-1)"
          value={formData.weather_severity}
          onChange={(e) => setFormData({ ...formData, weather_severity: parseFloat(e.target.value) })}
          min="0"
          max="1"
          step="0.1"
        />
        <input
          type="number"
          placeholder="Grid Load (0-1)"
          value={formData.grid_load}
          onChange={(e) => setFormData({ ...formData, grid_load: parseFloat(e.target.value) })}
          min="0"
          max="1"
          step="0.1"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Predicting...' : 'Predict ETA'}
        </button>
      </form>

      {result && (
        <div className="result">
          <h3>Outage Prediction:</h3>
          <p><strong>ETA:</strong> {result.eta_minutes} minutes</p>
          <p><strong>Confidence:</strong> {(result.confidence * 100).toFixed(1)}%</p>
          <p><strong>Reason:</strong> {result.reason}</p>
        </div>
      )}
    </div>
  );
}

export default {
  UrbanMLDashboard,
  PersonalizationComponent,
  RouteComponent,
  ImageTriageComponent,
  OutageComponent
};
