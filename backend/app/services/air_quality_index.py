"""US EPA AQI sub-index calculations for OpenAQ/OpenWeather concentrations.

Gas concentrations reported in mass units are converted to ppb/ppm at 25 C and
1 atm. Instantaneous readings are estimates: official EPA AQI requires specified
averaging periods (notably 8-hour ozone/CO and 24-hour PM).
"""

import math
from typing import Any

# US EPA Revised Breakpoints (2024 revised standard: PM2.5 0-9.0 ug/m3 is Good)
_PM25 = (
    (0.0, 9.0, 0, 50),
    (9.1, 35.4, 51, 100),
    (35.5, 55.4, 101, 150),
    (55.5, 125.4, 151, 200),
    (125.5, 225.4, 201, 300),
    (225.5, 325.4, 301, 500),
)
_PM10 = (
    (0, 54, 0, 50),
    (55, 154, 51, 100),
    (155, 254, 101, 150),
    (255, 354, 151, 200),
    (355, 424, 201, 300),
    (425, 604, 301, 500),
)
_O3 = (
    (0, 54, 0, 50),
    (55, 70, 51, 100),
    (71, 85, 101, 150),
    (86, 105, 151, 200),
    (106, 200, 201, 300),
)
_NO2 = (
    (0, 53, 0, 50),
    (54, 100, 51, 100),
    (101, 360, 101, 150),
    (361, 649, 151, 200),
    (650, 1249, 201, 300),
    (1250, 2049, 301, 500),
)
_SO2 = (
    (0, 35, 0, 50),
    (36, 75, 51, 100),
    (76, 185, 101, 150),
    (186, 304, 151, 200),
    (305, 604, 201, 300),
    (605, 1004, 301, 500),
)
_CO = (
    (0.0, 4.4, 0, 50),
    (4.5, 9.4, 51, 100),
    (9.5, 12.4, 101, 150),
    (12.5, 15.4, 151, 200),
    (15.5, 30.4, 201, 300),
    (30.5, 50.4, 301, 500),
)
_GAS_MW = {"o3": 48.0, "no2": 46.0055, "so2": 64.066, "co": 28.01}


def _number(value: Any) -> float | None:
    try:
        result = float(value)
        return result if math.isfinite(result) and result >= 0 else None
    except (TypeError, ValueError, OverflowError):
        return None


def _unit(unit: Any) -> str:
    return str(unit or "").lower().replace("µ", "u").replace("μ", "u").replace("³", "3").replace(" ", "")


def _mass_to_ug(value: Any, unit: Any) -> float | None:
    num, u = _number(value), _unit(unit)
    if num is None:
        return None
    if u.startswith("mg"):
        return num * 1000
    if u.startswith("ng"):
        return num / 1000
    return num


def _gas_ppb(value: Any, unit: Any, pollutant: str) -> float | None:
    num, u = _number(value), _unit(unit)
    if num is None:
        return None
    if u in ("ppb", "nmol/mol"):
        return num
    if u in ("ppm", "umol/mol"):
        return num * 1000
    if u.startswith("mg"):
        num *= 1000
    # OpenAQ/OpenWeather ambient gas mass concentrations are typically ug/m3.
    return num * 24.45 / _GAS_MW[pollutant]


def _gas_co_ppm(value: Any, unit: Any) -> float | None:
    ppb = _gas_ppb(value, unit, "co")
    return ppb / 1000 if ppb is not None else None


def _subindex(value: float | None, breakpoints: tuple, truncation: int = 0) -> int | None:
    val = _number(value)
    if val is None:
        return None
    scale = 10 ** truncation
    val = math.floor(val * scale) / scale
    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= val <= c_high:
            return round((i_high - i_low) / (c_high - c_low) * (val - c_low) + i_low)
    return 500 if val > breakpoints[-1][1] else None


def calculate_epa_aqi(measurements: dict) -> tuple[int | None, str | None, dict[str, int]]:
    """Return (maximum pollutant sub-index, dominant pollutant, sub-indices).

    Each pollutant can be a number or {value, unit}; unlabelled gases are treated
    as ug/m3, the common ambient mass unit returned by configured providers.
    """
    specs = {
        "pm25": ("PM2.5", _PM25, 1, _mass_to_ug),
        "pm10": ("PM10", _PM10, 0, _mass_to_ug),
        "o3": ("O3", _O3, 0, _gas_ppb),
        "no2": ("NO2", _NO2, 0, _gas_ppb),
        "so2": ("SO2", _SO2, 0, _gas_ppb),
        "co": ("CO", _CO, 1, _gas_co_ppm),
    }
    indices = {}
    for key, (label, ranges, digits, convert) in specs.items():
        raw = measurements.get(key)
        if isinstance(raw, dict):
            value, unit = raw.get("value"), raw.get("unit")
        else:
            value, unit = raw, None
        try:
            concentration = convert(value, unit, key) if key in ("o3", "no2", "so2") else convert(value, unit)
        except (TypeError, ValueError, OverflowError):
            concentration = None
        index = _subindex(concentration, ranges, digits)
        if index is not None:
            indices[label] = index

    if not indices:
        return None, None, {}
    dominant = max(indices, key=indices.get)
    return indices[dominant], dominant, indices


def particulate_aqi(pm25, pm25_unit=None, pm10=None, pm10_unit=None) -> int | None:
    """EPA AQI from available PM pollutants."""
    return calculate_epa_aqi({
        "pm25": {"value": pm25, "unit": pm25_unit},
        "pm10": {"value": pm10, "unit": pm10_unit},
    })[0]


def calculate_overall_aqi(pm25=None, pm10=None, o3=None, no2=None, co=None, so2=None):
    """Compatibility wrapper; calculates US EPA AQI across all passed pollutants."""
    data = pm25 if isinstance(pm25, dict) else {"pm25": pm25, "pm10": pm10, "o3": o3, "no2": no2, "co": co, "so2": so2}
    return calculate_epa_aqi(data)


def aqi_category(aqi: float | int | None) -> str:
    """Official US EPA 6-category standard classification."""
    if aqi is None:
        return "Unavailable"
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def aqi_color(aqi: float | int | None) -> str:
    """Official US EPA AQI color code palette."""
    if aqi is None:
        return "#64748b"
    if aqi <= 50:
        return "#10b981"  # Emerald Green
    if aqi <= 100:
        return "#eab308"  # Amber Yellow
    if aqi <= 150:
        return "#f97316"  # Sunset Orange
    if aqi <= 200:
        return "#ef4444"  # Crimson Red
    if aqi <= 300:
        return "#8b5cf6"  # Royal Purple
    return "#881337"      # Deep Maroon / Hazardous


def population_health_guidance(aqi: float | int | None) -> dict[str, dict[str, str]]:
    """Return population-specific medical & exposure advisories according to US EPA guidance."""
    cat = aqi_category(aqi)
    color = aqi_color(aqi)

    table = {
        "Good": {
            "children": {
                "risk_level": "Low",
                "badge": "Safe",
                "recommendation": "Ideal air quality for outdoor recess, physical education, and sports.",
                "action": "No precautions needed; encourage active outdoor play.",
            },
            "elderly": {
                "risk_level": "Low",
                "badge": "Safe",
                "recommendation": "Great conditions for regular walking, outdoor gardening, and community mobility.",
                "action": "Normal activities can be pursued freely.",
            },
            "asthma": {
                "risk_level": "Low",
                "badge": "Safe",
                "recommendation": "Low risk of airway reactivity or bronchospasm.",
                "action": "Maintain normal rescue inhaler maintenance routine.",
            },
            "outdoor_workers": {
                "risk_level": "Low",
                "badge": "Safe",
                "recommendation": "No respiratory exposure restrictions on job sites.",
                "action": "Standard occupational safety protocols apply.",
            },
            "general": {
                "risk_level": "Low",
                "badge": "Safe",
                "recommendation": "Air quality is considered satisfactory, and air pollution poses little or no risk.",
                "action": "Open windows for natural ventilation and enjoy outdoor activities.",
            },
        },
        "Moderate": {
            "children": {
                "risk_level": "Low-Moderate",
                "badge": "Notice",
                "recommendation": "Children with pre-existing allergies or respiratory infections should take more breaks.",
                "action": "Monitor children who cough or experience shortness of breath during exertion.",
            },
            "elderly": {
                "risk_level": "Moderate",
                "badge": "Watch",
                "recommendation": "Generally safe, but individuals with coronary disease should watch for fatigue.",
                "action": "Stay hydrated and take breaks during heavy physical exertion.",
            },
            "asthma": {
                "risk_level": "Moderate",
                "badge": "Caution",
                "recommendation": "Unusually sensitive individuals may experience mild coughing or irritation.",
                "action": "Keep quick-relief inhaler handy during strenuous exercise.",
            },
            "outdoor_workers": {
                "risk_level": "Low-Moderate",
                "badge": "Notice",
                "recommendation": "Prolonged shifts acceptable without specialized filtration masks.",
                "action": "Ensure access to clean drinking water and scheduled break areas.",
            },
            "general": {
                "risk_level": "Acceptable",
                "badge": "Moderate",
                "recommendation": "Air quality is acceptable; however, a small number of unusually sensitive individuals may be affected.",
                "action": "Good window for routine transit and outdoor recreation.",
            },
        },
        "Unhealthy for Sensitive Groups": {
            "children": {
                "risk_level": "High",
                "badge": "Restricted",
                "recommendation": "Children should take more breaks and do less strenuous activities outdoors.",
                "action": "Move prolonged aerobic running or athletic training indoors or to earlier hours.",
            },
            "elderly": {
                "risk_level": "Elevated",
                "badge": "Warning",
                "recommendation": "Increased risk for older adults with cardiovascular or pulmonary disease.",
                "action": "Reduce strenuous outdoor activities; prefer climate-controlled indoor venues.",
            },
            "asthma": {
                "risk_level": "High",
                "badge": "High Risk",
                "recommendation": "Significantly elevated risk of asthma attacks, bronchoconstriction, and coughing.",
                "action": "Pre-medicate if advised by physician; carry inhaler everywhere; reduce outdoor exposure.",
            },
            "outdoor_workers": {
                "risk_level": "Moderate-High",
                "badge": "Caution",
                "recommendation": "Sensitive workers should reduce prolonged continuous physical exertion.",
                "action": "Wear N95/FFP2 particulate mask if sensitive; schedule rotational rest breaks.",
            },
            "general": {
                "risk_level": "Moderate",
                "badge": "Caution",
                "recommendation": "Members of sensitive groups may experience health effects. The general public is less likely to be affected.",
                "action": "Sensitive individuals should limit prolonged outdoor exertion.",
            },
        },
        "Unhealthy": {
            "children": {
                "risk_level": "Severe",
                "badge": "Avoid",
                "recommendation": "Avoid prolonged or heavy outdoor exertion. School recess should be held indoors.",
                "action": "Keep windows closed in school buses and classrooms; operate air filtration.",
            },
            "elderly": {
                "risk_level": "High",
                "badge": "Stay Indoors",
                "recommendation": "High risk of aggravated heart disease, hypertension spikes, or lung irritation.",
                "action": "Remain indoors with HEPA air filtration operating; minimize errands outdoors.",
            },
            "asthma": {
                "risk_level": "Critical",
                "badge": "Trigger Alert",
                "recommendation": "High probability of severe asthma flares and reduced peak expiratory flow.",
                "action": "Avoid outdoor exertion entirely. Use preventative medications as directed; monitor peak flow.",
            },
            "outdoor_workers": {
                "risk_level": "High",
                "badge": "Mandatory PPE",
                "recommendation": "Substantial lung particulate deposition over 8-hour construction or delivery shifts.",
                "action": "Mandatory N95/KN95 masks; enforce 15-min clean-air breaks every 2 hours.",
            },
            "general": {
                "risk_level": "Unhealthy",
                "badge": "Unhealthy",
                "recommendation": "Some members of the general public may experience health effects; sensitive groups may experience more serious effects.",
                "action": "Everyone should reduce prolonged or heavy exertion outdoors. Keep windows shut.",
            },
        },
        "Very Unhealthy": {
            "children": {
                "risk_level": "Critical",
                "badge": "Hazard Alert",
                "recommendation": "All children must avoid all outdoor physical activity. Reschedule all sports events.",
                "action": "Maintain sealed indoor environment with running air purifiers.",
            },
            "elderly": {
                "risk_level": "Critical",
                "badge": "Hazard Alert",
                "recommendation": "Serious risk of acute cardiac events, arrhythmia, or respiratory distress.",
                "action": "Stay indoors in clean rooms; avoid any physical exertion. Seek medical care if chest pain occurs.",
            },
            "asthma": {
                "risk_level": "Emergency",
                "badge": "Danger",
                "recommendation": "Severe risk of acute bronchospasm and emergency room visitation.",
                "action": "Strictly remain indoors with HEPA filtration. Have emergency asthma action plan ready.",
            },
            "outdoor_workers": {
                "risk_level": "Critical",
                "badge": "Restricted Shifts",
                "recommendation": "Dangerous occupational exposure levels. Non-essential outdoor work should be suspended.",
                "action": "Certified N95/P100 respirators mandatory. Suspend heavy manual labor.",
            },
            "general": {
                "risk_level": "Very Unhealthy",
                "badge": "Health Alert",
                "recommendation": "Health alert: The risk of health effects is increased for everyone.",
                "action": "Avoid all outdoor physical activity. Use certified N95 masks if transit is unavoidable.",
            },
        },
        "Hazardous": {
            "children": {
                "risk_level": "Emergency",
                "badge": "Emergency",
                "recommendation": "Health warnings of emergency conditions. Entire population is affected.",
                "action": "School closures recommended. Complete avoidance of outdoor air.",
            },
            "elderly": {
                "risk_level": "Emergency",
                "badge": "Emergency",
                "recommendation": "Life-threatening exposure for elderly and vulnerable cardiac/pulmonary patients.",
                "action": "Seal living quarters; operate multiple HEPA purifiers. Contact healthcare providers if needed.",
            },
            "asthma": {
                "risk_level": "Emergency",
                "badge": "Emergency",
                "recommendation": "Extreme hazard. Indoor micro-environment must be strictly filtered.",
                "action": "Remain in clean air room. Follow emergency medical protocol immediately upon symptom onset.",
            },
            "outdoor_workers": {
                "risk_level": "Emergency",
                "badge": "Work Stop",
                "recommendation": "Emergency occupational hazard. All non-emergency outdoor work must be halted.",
                "action": "Mandatory work suspension across construction, mining, and open-air industrial sites.",
            },
            "general": {
                "risk_level": "Emergency",
                "badge": "Hazardous",
                "recommendation": "Health warnings of emergency conditions. Everyone is more likely to be affected.",
                "action": "Everyone should avoid all physical activity outdoors. Wear fit-tested N95/P100 if leaving building.",
            },
        },
    }

    selected = table.get(cat, table["Moderate"])
    return {
        "aqi": aqi,
        "category": cat,
        "color": color,
        "groups": selected,
        **selected,
    }
