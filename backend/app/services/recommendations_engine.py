"""AI Predictive Recommendation and Early Warning Engine based on 72-hour future forecast trajectory."""

from datetime import datetime
import logging
from typing import Any

logger = logging.getLogger(__name__)


def generate_predictive_recommendations(
    forecast_points: list[dict[str, Any]],
    fire_impact: dict[str, Any] | None = None,
    city: str = "Delhi NCR",
) -> dict[str, Any]:
    """
    Generate dynamic future-grounded recommendations, GRAP policy triggers,
    early warning alerts, and clean outdoor windows based on 72-hour forecast.
    """
    if not forecast_points:
        return {
            "early_warnings": [],
            "recommendations": [],
            "grap_stage": "None",
            "optimal_windows": [],
            "peak_risk_windows": [],
        }

    # 1. Analyze 72-hour trajectory
    max_aqi_point = max(forecast_points, key=lambda p: p["aqi"])
    min_aqi_point = min(forecast_points, key=lambda p: p["aqi"])
    max_pm25_point = max(forecast_points, key=lambda p: p["pm25"])
    max_o3_point = max(forecast_points, key=lambda p: p["o3"])

    avg_aqi = sum(p["aqi"] for p in forecast_points) / len(forecast_points)
    severe_points = [p for p in forecast_points if p["aqi"] > 400]
    very_poor_points = [p for p in forecast_points if 300 < p["aqi"] <= 400]
    poor_points = [p for p in forecast_points if 200 < p["aqi"] <= 300]
    moderate_or_better = [p for p in forecast_points if p["aqi"] <= 200]

    early_warnings = []
    recommendations = []
    grap_stage = "None"

    # 2. Early Warning System (24h - 72h advance detection)
    if severe_points:
        first_severe = severe_points[0]
        t = datetime.fromisoformat(first_severe["time"])
        early_warnings.append({
            "severity": "CRITICAL",
            "title": f"🚨 Severe Air Quality Alert (AQI {first_severe['aqi']})",
            "message": f"AQI in {city} is forecasted to breach Severe levels ({first_severe['aqi']}+) on {t.strftime('%A at %I:%M %p')}. High health risk for entire population.",
            "lead_time_hours": first_severe["hour_offset"],
            "target_time": first_severe["time"],
        })
    elif very_poor_points:
        first_vp = very_poor_points[0]
        t = datetime.fromisoformat(first_vp["time"])
        early_warnings.append({
            "severity": "HIGH",
            "title": f"⚠️ Very Poor AQI Warning ({first_vp['aqi']})",
            "message": f"Air quality will deteriorate into Very Poor ({first_vp['aqi']}) on {t.strftime('%A at %I:%M %p')}. Sensitive groups must stay indoors.",
            "lead_time_hours": first_vp["hour_offset"],
            "target_time": first_vp["time"],
        })
    elif poor_points:
        first_poor = poor_points[0]
        t = datetime.fromisoformat(first_poor["time"])
        early_warnings.append({
            "severity": "MODERATE",
            "title": f"⚡ Poor AQI Advisory ({first_poor['aqi']})",
            "message": f"AQI will enter Poor category on {t.strftime('%A at %I:%M %p')}. Reduce prolonged outdoor exertion.",
            "lead_time_hours": first_poor["hour_offset"],
            "target_time": first_poor["time"],
        })

    # Biomass Burning / Fire Alert
    fire_count = (fire_impact or {}).get("active_hotspots_detected", 0)
    if fire_count > 5:
        early_warnings.append({
            "severity": "HIGH",
            "title": f"🔥 Upwind Fire Plume Alert ({fire_count} Hotspots)",
            "message": f"NASA FIRMS detected {fire_count} active thermal anomalies in regional perimeter. Agricultural residue smoke advection expected to increase PM2.5 in next 24–48 hours.",
            "lead_time_hours": 24,
            "target_time": forecast_points[min(23, len(forecast_points) - 1)]["time"],
        })

    # 3. Graded Response Action Plan (GRAP) for Delhi NCR
    if max_aqi_point["aqi"] > 450:
        grap_stage = "Stage IV (Severe+ / Emergency)"
        recommendations.append({
            "category": "Policy & GRAP",
            "urgency": "Emergency",
            "action": "Enforce GRAP Stage IV Emergency Measures",
            "rationale": f"Forecasted AQI peaks at {max_aqi_point['aqi']}. Halt non-essential heavy diesel trucks and non-critical construction, and mandate remote work/school closure.",
        })
    elif max_aqi_point["aqi"] > 400:
        grap_stage = "Stage III (Severe)"
        recommendations.append({
            "category": "Policy & GRAP",
            "urgency": "High",
            "action": "Implement GRAP Stage III Protocols",
            "rationale": f"Forecasted AQI enters Severe ({max_aqi_point['aqi']}). Ban non-essential demolition, mining, and restrict BS-III petrol / BS-IV diesel vehicles.",
        })
    elif max_aqi_point["aqi"] > 300:
        grap_stage = "Stage II (Very Poor)"
        recommendations.append({
            "category": "Policy & GRAP",
            "urgency": "Medium",
            "action": "Enact GRAP Stage II Measures",
            "rationale": f"Forecasted AQI exceeds 300. Diesel generator restrictions, increased bus/metro frequency, and continuous water sprinkling across transit corridors.",
        })
    elif max_aqi_point["aqi"] > 200:
        grap_stage = "Stage I (Poor)"
        recommendations.append({
            "category": "Policy & GRAP",
            "urgency": "Low",
            "action": "Maintain GRAP Stage I Vigilance",
            "rationale": f"Forecasted AQI reaches Poor ({max_aqi_point['aqi']}). Mechanized road vacuum sweeping and strict monitoring of unpaved road dust.",
        })

    # 4. Public Health & Personal Protective Recommendations
    if max_pm25_point["pm25"] > 200:
        recommendations.append({
            "category": "Personal Health",
            "urgency": "Critical",
            "action": "Equip Certified N95 / FFP2 Masks",
            "rationale": f"Future PM2.5 is forecasted to reach {max_pm25_point['pm25']} µg/m³. Standard surgical or cloth masks provide inadequate sub-micron particle filtration.",
        })
        recommendations.append({
            "category": "Activity Guidance",
            "urgency": "Critical",
            "action": "Suspend Morning Outdoor Runs and Strenuous Workouts",
            "rationale": f"Heavy physical exercise increases inhaled particle deposition by 4–5x during nocturnal and morning inversion spikes.",
        })

    if max_aqi_point["aqi"] > 300:
        recommendations.append({
            "category": "Indoor Environment",
            "urgency": "High",
            "action": "Operate HEPA Air Filtration Indoors",
            "rationale": "Pre-filter residential spaces ahead of forecasted peak; keep windows and balcony access sealed between 6:00 PM and 9:00 AM.",
        })

    if max_o3_point["o3"] > 90:
        recommendations.append({
            "category": "Photochemical Smog",
            "urgency": "Moderate",
            "action": "Avoid Outdoor Exertion in Mid-Afternoon (1:00 PM – 4:30 PM)",
            "rationale": f"Ground-level ozone peaks at {max_o3_point['o3']} µg/m³ driven by afternoon UV irradiation. Can trigger airway constriction in asthmatic individuals.",
        })

    # 5. Optimal Clean Window vs Peak Risk Window
    optimal_windows = []
    if moderate_or_better:
        best_point = min(moderate_or_better, key=lambda p: p["aqi"])
        t = datetime.fromisoformat(best_point["time"])
        optimal_windows.append({
            "time_window": f"{t.strftime('%A, %b %d at %I:%M %p')}",
            "aqi": best_point["aqi"],
            "category": best_point["category"],
            "recommendation": "Safest scheduled window for outdoor transit, grocery runs, or indoor natural ventilation.",
        })

    peak_risk_windows = []
    if max_aqi_point["aqi"] > 200:
        t_peak = datetime.fromisoformat(max_aqi_point["time"])
        peak_risk_windows.append({
            "time_window": f"{t_peak.strftime('%A, %b %d at %I:%M %p')}",
            "peak_aqi": max_aqi_point["aqi"],
            "category": max_aqi_point["category"],
            "dominant_pollutant": max_aqi_point["dominant_pollutant"],
            "recommendation": "Maximum pollution concentration window. Stay indoors in air-purified environments.",
        })

    from .air_quality_index import population_health_guidance
    pop_guidance = population_health_guidance(max_aqi_point["aqi"])

    return {
        "early_warnings": early_warnings,
        "recommendations": recommendations,
        "population_guidance": pop_guidance["groups"],
        "grap_stage": grap_stage,
        "optimal_windows": optimal_windows,
        "peak_risk_windows": peak_risk_windows,
        "summary": f"In {city}, 72-hour AQI is forecasted to fluctuate between {min_aqi_point['aqi']} ({min_aqi_point['category']}) and {max_aqi_point['aqi']} ({max_aqi_point['category']}). {grap_stage} precautions recommended.",
    }

