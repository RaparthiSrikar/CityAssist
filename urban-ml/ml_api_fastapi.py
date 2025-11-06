from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import joblib
import os
import json
import hashlib
import logging
import redis
import numpy as np
from datetime import datetime, timedelta
from io import BytesIO
from PIL import Image

logger = logging.getLogger("uvicorn")
logging.basicConfig(level=logging.INFO)

APP_NAME = "urban-ml-fastapi"
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")

# Redis config
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL_SECONDS = int(os.environ.get("CACHE_TTL_SECONDS", "60"))

def get_redis():
    try:
        r = redis.from_url(REDIS_URL)
        # quick ping to ensure connection
        r.ping()
        return r
    except Exception as e:
        logger.warning("Redis not available: %s", e)
        return None

redis_client = get_redis()


def cache_response(key: str, value: dict, ttl: int = CACHE_TTL_SECONDS):
    if not redis_client:
        return
    try:
        redis_client.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning("Failed to cache response: %s", e)


def get_cached(key: str) -> Optional[dict]:
    if not redis_client:
        return None
    try:
        v = redis_client.get(key)
        if v is None:
            return None
        return json.loads(v)
    except Exception as e:
        logger.warning("Cache read failed: %s", e)
        return None


def payload_hash(obj: Any) -> str:
    j = json.dumps(obj, sort_keys=True, default=str)
    return hashlib.sha256(j.encode("utf-8")).hexdigest()


def load_model_safe(name: str):
    path = os.path.join(ARTIFACTS_DIR, f"{name}.pkl")
    if os.path.exists(path):
        try:
            model = joblib.load(path)
            logger.info("Loaded model from %s", path)
            return model
        except Exception as e:
            logger.exception("Failed loading model %s: %s", path, e)
            return None
    else:
        logger.info("Model artifact not found: %s", path)
        return None


# Load models (may be None; we implement fallbacks)
personalization_model = load_model_safe("personalization")
route_model = load_model_safe("route_model")
outage_model = load_model_safe("outage_eta")
image_model = load_model_safe("image_triage")


app = FastAPI(title=APP_NAME)


class PersonalizationInput(BaseModel):
    user_id: Optional[str]
    age: Optional[int]
    sensitivity: Optional[float] = 1.0
    chronic_conditions: Optional[List[str]] = []
    aqi: float


class PersonalizationOutput(BaseModel):
    send_alert: bool
    severity: str
    reason: str


class RouteRequest(BaseModel):
    origin: str
    destination: str
    user_prefs: Optional[Dict[str, Any]] = {}
    traffic_level: Optional[float] = 0.5  # 0..1
    incidents: Optional[List[Dict[str, Any]]] = []


class RouteResponse(BaseModel):
    recommended_route: List[str]
    eta_minutes: int
    reason: str


class OutageRequest(BaseModel):
    outage_start: Optional[datetime]
    affected_customers: int
    weather_severity: Optional[float] = 0.0
    grid_load: Optional[float] = 0.5


class OutageResponse(BaseModel):
    eta_minutes: int
    confidence: float
    reason: str


class ImageTriageResponse(BaseModel):
    label: str
    priority: str
    reason: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": {
            "personalization": personalization_model is not None,
            "route_model": route_model is not None,
            "outage_eta": outage_model is not None,
            "image_triage": image_model is not None,
        },
    }


@app.get("/models")
def models():
    return {
        "models": {
            "personalization": getattr(personalization_model, "__class__", None).__name__ if personalization_model else None,
            "route_model": getattr(route_model, "__class__", None).__name__ if route_model else None,
            "outage_eta": getattr(outage_model, "__class__", None).__name__ if outage_model else None,
            "image_triage": getattr(image_model, "__class__", None).__name__ if image_model else None,
        }
    }


@app.post("/predict/personalization", response_model=PersonalizationOutput)
def predict_personalization(inp: PersonalizationInput):
    key = f"personalization:{payload_hash(inp.dict())}"
    cached = get_cached(key)
    if cached:
        return cached

    # Try model if available
    if personalization_model is not None:
        try:
            # assume model expects [age, sensitivity, aqi, chronic_count]
            X = np.array([[inp.age or 40, inp.sensitivity or 1.0, inp.aqi, len(inp.chronic_conditions or [])]])
            pred = personalization_model.predict(X)
            # assume model returns 0/1 for send_alert
            send = bool(int(pred[0]))
            severity = "high" if inp.aqi > 200 else ("moderate" if inp.aqi > 100 else "low")
            reason = "Model-based decision"
            out = {"send_alert": send, "severity": severity, "reason": reason}
            cache_response(key, out)
            return out
        except Exception as e:
            logger.exception("Personalization model inference failed: %s", e)

    # Fallback heuristic
    age = inp.age or 40
    sensitivity = inp.sensitivity or 1.0
    chronic = len(inp.chronic_conditions or [])
    threshold = 150
    # adjust threshold: older or chronic -> lower threshold
    threshold -= int((age - 40) * 0.5) + chronic * 20
    threshold = max(50, threshold)
    send_alert = inp.aqi >= threshold or (inp.aqi >= 100 and sensitivity > 1.5)
    severity = "high" if inp.aqi >= 200 else ("moderate" if inp.aqi >= 100 else "low")
    reason_parts = []
    reason_parts.append(f"AQI {inp.aqi} vs threshold {threshold}")
    if age >= 65:
        reason_parts.append("age >=65 -> more sensitive")
    if chronic:
        reason_parts.append(f"{chronic} chronic conditions -> more sensitive")
    reason = "; ".join(reason_parts)
    out = {"send_alert": bool(send_alert), "severity": severity, "reason": reason}
    cache_response(key, out)
    return out


@app.post("/predict/route", response_model=RouteResponse)
def predict_route(req: RouteRequest):
    key = f"route:{payload_hash(req.dict())}"
    cached = get_cached(key)
    if cached:
        return cached

    # If a lightweight route model exists, call it
    if route_model is not None:
        try:
            # For generic models, pass traffic_level and user_prefs flattened
            # This is illustrative; adapt to real model signature
            X = np.array([[req.traffic_level]])
            preds = route_model.predict(X)
            # assume preds are list of route IDs / names
            route = [str(preds[0])]
            eta = int(15 + req.traffic_level * 60)
            reason = "Model-proposed route considering traffic level"
            out = {"recommended_route": route, "eta_minutes": eta, "reason": reason}
            cache_response(key, out)
            return out
        except Exception as e:
            logger.exception("Route model inference failed: %s", e)

    # Fallback rules + simple heuristic
    prefs = req.user_prefs or {}
    avoid_highways = bool(prefs.get("avoid_highways", False))
    prefer_bus_lanes = bool(prefs.get("prefer_bus_lanes", False))
    base_eta = 10
    traffic_penalty = int(req.traffic_level * 60)
    incident_penalty = 0
    incident_details = []
    for inc in (req.incidents or []):
        incident_penalty += 10
        incident_details.append(inc.get("type", "incident") + " at " + inc.get("location", "unknown"))

    eta = base_eta + traffic_penalty + incident_penalty
    recommended_route = ["main_street"]
    if avoid_highways:
        recommended_route = ["local_roads_via_X"]
    elif req.traffic_level > 0.8:
        recommended_route = ["alt_route_1"]
    elif prefer_bus_lanes:
        recommended_route = ["bus_lane_friendly_route"]

    reason_items = [f"traffic level {req.traffic_level}"]
    if incident_details:
        reason_items.append("incidents: " + ", ".join(incident_details))
    if avoid_highways:
        reason_items.append("user prefers to avoid highways")
    reason = "; ".join(reason_items)
    out = {"recommended_route": recommended_route, "eta_minutes": int(eta), "reason": reason}
    cache_response(key, out)
    return out


@app.post("/predict/outage_eta", response_model=OutageResponse)
def predict_outage_eta(req: OutageRequest):
    key = f"outage:{payload_hash(req.dict())}"
    cached = get_cached(key)
    if cached:
        return cached

    # Use model if present
    if outage_model is not None:
        try:
            # assume model takes [affected_customers, weather_severity, grid_load]
            X = np.array([[req.affected_customers, req.weather_severity or 0.0, req.grid_load or 0.5]])
            pred = outage_model.predict(X)
            eta = max(1, int(pred[0]))
            out = {"eta_minutes": eta, "confidence": 0.7, "reason": "Model prediction based on historical outages"}
            cache_response(key, out)
            return out
        except Exception as e:
            logger.exception("Outage model inference failed: %s", e)

    # Fallback heuristic: base time + customers factor + weather factor
    base = 30
    customers_factor = int(req.affected_customers / 100)
    weather_factor = int((req.weather_severity or 0.0) * 60)
    load_factor = int((req.grid_load or 0.5) * 30)
    eta_est = base + customers_factor * 10 + weather_factor + load_factor
    confidence = 0.5 if req.weather_severity and req.weather_severity > 0.7 else 0.7
    reason = f"Base {base} + customers factor {customers_factor*10} + weather {weather_factor} + load {load_factor}"
    out = {"eta_minutes": int(eta_est), "confidence": float(confidence), "reason": reason}
    cache_response(key, out)
    return out


@app.post("/predict/image_triage", response_model=ImageTriageResponse)
async def predict_image_triage(file: UploadFile = File(...)):
    # Read bytes
    contents = await file.read()
    key = f"image:{payload_hash({'filename': file.filename, 'size': len(contents)})}"
    cached = get_cached(key)
    if cached:
        return cached

    # If model exists and supports predict_proba or predict
    if image_model is not None:
        try:
            # Many image models accept preprocessed arrays; we attempt a minimal preprocessing
            img = Image.open(BytesIO(contents)).convert("RGB")
            img = img.resize((64, 64))
            arr = np.array(img).astype(np.float32) / 255.0
            arr = arr.reshape(1, -1)
            pred = image_model.predict(arr)
            label = str(pred[0])
            priority = "high" if label in ("pothole", "tree_fall") else "normal"
            reason = f"Model classified image as {label}"
            out = {"label": label, "priority": priority, "reason": reason}
            cache_response(key, out)
            return out
        except Exception as e:
            logger.exception("Image model inference failed: %s", e)

    # Fallback: quick heuristic based on image brightness / aspect ratio / size
    try:
        img = Image.open(BytesIO(contents)).convert("L")
        arr = np.array(img)
        mean = float(arr.mean())
        w, h = img.size
        # crude rules: bright image -> garbage, small dark -> pothole, tall tree-like -> tree fall
        if mean > 160:
            label = "garbage"
            priority = "low"
        elif h > w * 1.2:
            label = "tree_fall"
            priority = "high"
        else:
            # if image has dark pothole-like area (very low mean)
            label = "pothole" if mean < 80 else "other"
            priority = "high" if label == "pothole" else "normal"
        reason = f"Heuristic: mean_brightness={mean:.1f}, size={w}x{h}"
        out = {"label": label, "priority": priority, "reason": reason}
        cache_response(key, out)
        return out
    except Exception as e:
        logger.exception("Fallback image triage failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid image")


if __name__ == "__main__":
    # Simple local runner when file is executed directly. Use environment's uvicorn for production.
    import uvicorn

    # Provide a helpful message for users
    logger.info("Starting %s on http://127.0.0.1:8000", APP_NAME)
    uvicorn.run("ml_api_fastapi:app", host="0.0.0.0", port=8000, log_level="info")
