# Urban ML Frontend Integration Guide

## Overview
This guide shows how to integrate your frontend with the Urban ML FastAPI backend.

## Backend Endpoints

### 1. Health Check
```
GET /health
```
Returns: Backend status, version, model status, Redis status

### 2. Get Available Models
```
GET /models
```
Returns: List of loaded models and their types

### 3. Personalization Alert (Air Quality)
```
POST /predict/personalization
Content-Type: application/json

{
  "user_id": "user123",
  "age": 45,
  "aqi": 150,
  "sensitivity": 1.2,
  "chronic_conditions": ["asthma", "heart_disease"]
}
```
Returns:
```json
{
  "send_alert": true,
  "severity": "high",
  "reason": "AQI 150 vs threshold 150; age >=65 -> more sensitive"
}
```

### 4. Route Recommendation
```
POST /predict/route
Content-Type: application/json

{
  "origin": "Main St & 5th Ave",
  "destination": "Downtown Station",
  "traffic_level": 0.7,
  "user_prefs": {
    "avoid_highways": true,
    "prefer_bus_lanes": false
  },
  "incidents": [
    {
      "type": "accident",
      "location": "Highway 101"
    }
  ]
}
```
Returns:
```json
{
  "recommended_route": ["local_roads_via_X"],
  "eta_minutes": 25,
  "reason": "traffic level 0.7; incidents: accident at Highway 101; user prefers to avoid highways"
}
```

### 5. Outage ETA Prediction
```
POST /predict/outage_eta
Content-Type: application/json

{
  "outage_start": "2025-11-12T14:30:00",
  "affected_customers": 500,
  "weather_severity": 0.8,
  "grid_load": 0.6
}
```
Returns:
```json
{
  "eta_minutes": 45,
  "confidence": 0.7,
  "reason": "Base 30 + customers factor 50 + weather 48 + load 18"
}
```

### 6. Image Triage (Street Issues)
```
POST /predict/image_triage
Content-Type: multipart/form-data

File: <image file>
```
Returns:
```json
{
  "label": "pothole",
  "priority": "high",
  "reason": "Heuristic: mean_brightness=45.3, size=800x600"
}
```

## Frontend Setup

### For React
1. Copy `api_client.js` to your React project's `src/` folder
2. Import and use the functions:
```javascript
import * as UrbanMLAPI from './api_client';

// Check health
const health = await UrbanMLAPI.checkHealth();

// Get personalization alert
const alert = await UrbanMLAPI.getPersonalizationAlert({
  user_id: 'user123',
  age: 45,
  aqi: 150,
  sensitivity: 1.2,
  chronic_conditions: ['asthma']
});
```

### For Vue
Use the same `api_client.js` in your Vue components:
```vue
<script>
import * as UrbanMLAPI from '@/api_client';

export default {
  methods: {
    async fetchAlert() {
      this.alert = await UrbanMLAPI.getPersonalizationAlert({
        user_id: this.userId,
        age: this.age,
        aqi: this.aqi
      });
    }
  }
}
</script>
```

### For Vanilla JavaScript
```html
<script src="api_client.js"></script>
<script>
// Use UrbanMLAPI.getRoute(), etc.
</script>
```

## Environment Configuration

Set the API URL via environment variables:

**React (.env)**
```
REACT_APP_API_URL=http://localhost:8000
```

**Production (change to your deployment URL)**
```
REACT_APP_API_URL=https://api.yourdomain.com
```

## Running the Backend

### Development
```bash
cd c:\Users\user\Downloads\urban-ml\urban-ml
python ml_api_fastapi.py
```

Backend will run on `http://localhost:8000`

### Production
Use Uvicorn directly:
```bash
uvicorn ml_api_fastapi:app --host 0.0.0.0 --port 8000
```

## Testing Endpoints

### Using Swagger UI
Open `http://localhost:8000/docs` in your browser to test all endpoints

### Using cURL
```bash
# Health check
curl http://localhost:8000/health

# Personalization alert
curl -X POST http://localhost:8000/predict/personalization \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user1","age":45,"aqi":150,"sensitivity":1.0}'

# Route recommendation
curl -X POST http://localhost:8000/predict/route \
  -H "Content-Type: application/json" \
  -d '{"origin":"Main St","destination":"Downtown","traffic_level":0.5}'

# Image triage
curl -X POST http://localhost:8000/predict/image_triage \
  -F "file=@image.jpg"
```

## CORS Configuration

The backend is configured with CORS enabled. In production, update `ml_api_fastapi.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Error Handling

All API functions return error objects:
```javascript
{
  "send_alert": false,
  "severity": "error",
  "reason": "Error message here"
}
```

Always check for errors in responses:
```javascript
const result = await UrbanMLAPI.getPersonalizationAlert(data);
if (result.severity === "error") {
  console.error("API Error:", result.reason);
}
```

## Example: Complete Integration

```javascript
async function initializeApp() {
  // Check backend availability
  const health = await UrbanMLAPI.checkHealth();
  if (health.status !== "ok") {
    console.error("Backend unavailable");
    return;
  }

  // Get user's air quality alert
  const alert = await UrbanMLAPI.getPersonalizationAlert({
    user_id: currentUser.id,
    age: currentUser.age,
    aqi: currentAQI,
    sensitivity: currentUser.sensitivity
  });

  if (alert.send_alert) {
    showNotification(`Air Quality Alert: ${alert.severity}`);
  }

  // Get recommended route
  const route = await UrbanMLAPI.getRoute({
    origin: userLocation,
    destination: destination,
    traffic_level: currentTraffic
  });

  displayRoute(route.recommended_route, route.eta_minutes);
}
```

## Performance Tips

1. **Cache Responses**: The backend caches predictions for 60 seconds (configurable)
2. **Batch Operations**: Use `batchPredict()` for multiple predictions
3. **Lazy Load**: Only fetch models status when needed
4. **Error Boundaries**: Wrap API calls in try-catch blocks

## Support

For issues or questions:
1. Check backend logs: `http://localhost:8000/health`
2. Review API docs: `http://localhost:8000/docs`
3. Check error messages in browser console
