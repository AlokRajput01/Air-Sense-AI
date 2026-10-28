from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Location(APIModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class SourceStatus(APIModel):
    provider: str
    status: Literal["available", "unavailable", "stale"]
    fetched_at: datetime | None = None
    detail: str | None = None


class WeatherResponse(APIModel):
    source: str
    location: Location
    observed_at: datetime
    fetched_at: datetime
    temperature_c: float
    feels_like_c: float | None = None
    humidity_percent: float | None = None
    pressure_hpa: float | None = None
    wind_speed_mps: float | None = None
    wind_direction_degrees: float | None = None
    cloud_percent: float | None = None
    precipitation_mm: float | None = None
    description: str | None = None


class AirQualityStation(APIModel):
    id: int
    name: str
    locality: str | None = None
    coordinates: dict[str, float | None] = Field(default_factory=dict)
    distance_km: float | None = None
    aqi: float | None = None
    aqi_note: str | None = None
    measurements: dict[str, dict[str, Any]] = Field(default_factory=dict)


class AirQualityResponse(APIModel):
    source: Literal["OpenAQ", "OpenWeather", "OpenAQ+OpenWeather"] = "OpenAQ"
    location: Location
    place_name: str | None = None
    aqi: float | None = None
    aqi_note: str | None = None
    pm25: float | None = None
    pm10: float | None = None
    no2: float | None = None
    so2: float | None = None
    o3: float | None = None
    co: float | None = None
    timestamp: datetime | None = None
    station: str | None = None
    station_details: AirQualityStation | None = None
    stations: list[AirQualityStation] = Field(default_factory=list)
    measurements: dict[str, dict[str, Any]] = Field(default_factory=dict)
    fetched_at: datetime


class HistoricalMeasurement(APIModel):
    parameter: str
    value: float
    unit: str
    observed_at: datetime


class AirQualityHistoryResponse(APIModel):
    source: Literal["OpenAQ"] = "OpenAQ"
    location: Location
    days: int
    station: dict[str, Any] | None = None
    measurements: list[HistoricalMeasurement] = Field(default_factory=list)


class FireHotspot(APIModel):
    source_id: str
    latitude: float
    longitude: float
    acquired_at: datetime
    confidence: str | None = None
    fire_radiative_power_mw: float | None = None
    satellite: str | None = None
    instrument: str | None = None
    daynight: str | None = None
    source: str = "NASA FIRMS"


class FireResponse(APIModel):
    fetched_at: datetime
    hotspots: list[FireHotspot]


class UnavailableResponse(APIModel):
    status: Literal["unavailable"] = "unavailable"
    message: str = "Data Currently Unavailable"
    reason: str
    source_status: list[SourceStatus] = Field(default_factory=list)


class ForecastPoint(APIModel):
    target_at: datetime
    pollutant: str
    predicted_value: float
    unit: str
    lower_bound: float | None = None
    upper_bound: float | None = None
    model_version: str
    explanation: dict[str, Any] = Field(default_factory=dict)


class HourlyForecastRecord(APIModel):
    time: str
    target_at: datetime | None = None
    hour_offset: int | None = None
    pm25: float
    pm10: float
    o3: float
    no2: float
    aqi: int
    confidence: float
    category: str | None = None
    dominant_pollutant: str | None = None
    weather: dict[str, Any] | None = None
    explanation: dict[str, Any] | None = None


class ForecastResponse(APIModel):
    # Existing fields: 100% byte-for-byte preserved
    location: Location
    issued_at: datetime
    training_data_cutoff: datetime
    points: list[ForecastPoint]
    provenance: list[SourceStatus]
    coverage_warning: str | None = None

    # Extended optional fields for 72h forecast & analytics
    city: str | None = None
    horizon_hours: int | None = None
    confidence: float | None = None
    category: str | None = None
    forecast: list[HourlyForecastRecord] = Field(default_factory=list)
    peak_prediction: dict[str, Any] | None = None
    best_hour: dict[str, Any] | None = None
    worst_hour: dict[str, Any] | None = None
    trend_direction: str | None = None
    confidence_score: float | None = None
    analytics: dict[str, Any] | None = None
    early_warnings: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[dict[str, Any]] = Field(default_factory=list)
    grap_stage: str | None = None
    optimal_windows: list[dict[str, Any]] = Field(default_factory=list)
    peak_risk_windows: list[dict[str, Any]] = Field(default_factory=list)
    summary: str | None = None
    regional_ncr_comparison: list[dict[str, Any]] = Field(default_factory=list)


class PredictiveForecastResponse(APIModel):
    city: str
    location: Location
    issued_at: datetime
    horizon_hours: int
    model_name: str
    model_version: str
    fire_impact: dict[str, Any] = Field(default_factory=dict)
    forecast: list[HourlyForecastRecord]
    peak_prediction: dict[str, Any] | None = None
    best_hour: dict[str, Any] | None = None
    worst_hour: dict[str, Any] | None = None
    trend_direction: str | None = None
    confidence_score: float | None = None
    analytics: dict[str, Any] | None = None
    early_warnings: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[dict[str, Any]] = Field(default_factory=list)
    grap_stage: str | None = None
    optimal_windows: list[dict[str, Any]] = Field(default_factory=list)
    peak_risk_windows: list[dict[str, Any]] = Field(default_factory=list)
    summary: str | None = None
    regional_ncr_comparison: list[dict[str, Any]] = Field(default_factory=list)


class HistoricalAQIRecord(APIModel):
    timestamp: datetime
    latitude: float
    longitude: float
    city: str
    pm25: float | None = None
    pm10: float | None = None
    o3: float | None = None
    no2: float | None = None
    co: float | None = None
    so2: float | None = None
    temperature: float | None = None
    humidity: float | None = None
    wind_speed: float | None = None
    pressure: float | None = None
    overall_aqi: int | None = None



class InversionResponse(APIModel):
    status: Literal["available", "unavailable"]
    indicator: str | None = None
    explanation: str
    inputs: dict[str, Any] = Field(default_factory=dict)
    source: str = "OpenWeather"
    observed_at: datetime | None = None


class HealthRiskResponse(APIModel):
    status: Literal["available", "unavailable"]
    risk_category: str | None = None
    guidance: list[str] = Field(default_factory=list)
    population_guidance: dict[str, Any] | None = None
    basis: dict[str, Any] = Field(default_factory=dict)
    disclaimer: str = "General guidance only; this is not medical advice."


class Recommendation(APIModel):
    text: str
    rationale: str
    sources: list[str]
    observed_at: datetime | None = None


class RecommendationsResponse(APIModel):
    status: Literal["available", "unavailable"]
    recommendations: list[Recommendation] = Field(default_factory=list)
    message: str | None = None


class RouteSegment(APIModel):
    start_point: list[float]
    end_point: list[float]
    distance_m: float
    duration_s: float
    aqi: int
    pm25: float
    category: str
    color: str


class EvaluatedRoute(APIModel):
    id: str
    title: str
    summary: str
    distance_km: float
    duration_min: float
    average_aqi: int
    peak_aqi: int
    average_pm25: float
    inhaled_pm25_ug: float
    category: str
    is_recommended: bool
    coordinates: list[list[float]]
    segments: list[RouteSegment]
    key_advantages: list[str] = Field(default_factory=list)


class CleanRouteResponse(APIModel):
    origin: Location
    origin_name: str | None = None
    destination: Location
    destination_name: str | None = None
    mode: Literal["driving", "cycling", "walking"] = "driving"
    savings_percent: float
    time_difference_min: float
    fastest_route: EvaluatedRoute
    cleanest_route: EvaluatedRoute
    health_verdict: str
    mask_recommendation: str
    generated_at: datetime

