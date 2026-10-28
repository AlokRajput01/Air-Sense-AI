export type Location = { latitude: number; longitude: number }
export type Weather = { source: string; location: Location; observed_at: string; fetched_at: string; temperature_c: number; feels_like_c?: number | null; humidity_percent?: number | null; pressure_hpa?: number | null; wind_speed_mps?: number | null; wind_direction_degrees?: number | null; cloud_percent?: number | null; description?: string | null }
export type AirMeasurement = { value: number; unit: string; observed_at: string | null }
export type AirQualityStation = { id: number; name: string; locality?: string | null; coordinates: { latitude?: number | null; longitude?: number | null }; distance_km?: number | null; aqi?: number | null; aqi_note?: string | null; measurements: Record<string, AirMeasurement> }
export type AirQuality = { source: 'OpenAQ' | 'OpenWeather' | 'OpenAQ+OpenWeather'; location: Location; place_name?: string | null; aqi: number | null; aqi_note?: string; pm25: number | null; pm10: number | null; no2: number | null; so2: number | null; o3: number | null; co: number | null; timestamp: string | null; station: string | null; station_details?: AirQualityStation | null; stations: AirQualityStation[]; measurements: Record<string, AirMeasurement>; fetched_at: string }
export type AirQualityHistory = { source: 'OpenAQ'; location: Location; days: number; station: { id: number; name?: string | null; locality?: string | null; coordinates: { latitude?: number | null; longitude?: number | null } } | null; measurements: { parameter: string; value: number; unit: string; observed_at: string }[] }
export type Hotspot = { source_id: string; latitude: number; longitude: number; acquired_at: string; confidence?: string | null; fire_radiative_power_mw?: number | null; satellite?: string | null; source: string }
export type FireData = { fetched_at: string; hotspots: Hotspot[] }

export type HourlyForecastRecord = {
  time: string
  target_at?: string
  hour_offset: number
  pm25: number
  pm10: number
  o3: number
  no2: number
  aqi: number
  confidence: number
  category: string
  dominant_pollutant: string
  weather?: {
    temperature_c: number
    humidity_percent: number
    wind_speed_mps: number
    pressure_hpa: number
  }
}

export type EarlyWarning = {
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE'
  title: string
  message: string
  lead_time_hours: number
  target_time: string
}

export type ActionableRecommendation = {
  category: string
  urgency: string
  action: string
  rationale: string
}

export type AnalyticsData = {
  city: string
  analyzed_at: string
  record_count: number
  daily_trend: string
  weekly_trend: string
  monthly_trend: string
  peak_pollution_hours: string
  low_pollution_hours: string
  peak_rise_percentage: number
  low_dip_percentage: number
  pollutant_correlations: Record<string, number>
  weather_impact: {
    wind_speed_correlation: number
    wind_speed_reduction_pct: number
    humidity_correlation: number
    humidity_increase_pct: number
    temperature_correlation: number
    summary: string
  }
  insights: string[]
  hourly_diurnal_profile: Record<string, number>
}

export type Forecast = {
  city?: string
  location: Location
  issued_at: string
  horizon_hours?: number
  model_name?: string
  model_version?: string
  fire_impact?: {
    active_hotspots_detected: number
    total_frp_mw: number
    smoke_advection_multiplier: number
  }
  forecast?: HourlyForecastRecord[]
  peak_prediction?: { time: string; aqi: number }
  best_hour?: { time: string; aqi: number }
  worst_hour?: { time: string; aqi: number }
  trend_direction?: 'rising' | 'falling' | 'stable'
  confidence_score?: number
  points: { target_at: string; pollutant: string; predicted_value: number; unit: string; lower_bound?: number; upper_bound?: number; model_version: string; explanation: Record<string, unknown> }[]
  provenance: { provider: string; status: string }[]
  coverage_warning?: string
  analytics?: AnalyticsData
  early_warnings?: EarlyWarning[]
  recommendations?: ActionableRecommendation[]
  grap_stage?: string
  optimal_windows?: { time_window: string; aqi: number; category: string; recommendation: string }[]
  peak_risk_windows?: { time_window: string; peak_aqi: number; category: string; dominant_pollutant: string; recommendation: string }[]
  summary?: string
  regional_ncr_comparison?: { city: string; avg_aqi_72h: number; peak_aqi_72h: number; category: string; coordinates: Location }[]
}

export type Inversion = { status: string; indicator?: string | null; explanation: string; inputs: Record<string, unknown>; observed_at?: string | null }
export type PopulationAdvisory = { risk_level: string; badge: string; recommendation: string; action: string }
export type Risk = {
  status: string
  risk_category?: string | null
  guidance: string[]
  population_guidance?: Record<string, PopulationAdvisory>
  basis: Record<string, unknown>
  disclaimer: string
}
export type Recommendations = { status: string; recommendations: { text: string; rationale: string; sources: string[]; observed_at?: string | null }[]; message?: string | null }

export type RouteSegment = {
  start_point: [number, number]
  end_point: [number, number]
  distance_m: number
  duration_s: number
  aqi: number
  pm25: number
  category: string
  color: string
}

export type EvaluatedRoute = {
  id: 'clean' | 'fastest'
  title: string
  summary: string
  distance_km: number
  duration_min: number
  average_aqi: number
  peak_aqi: number
  average_pm25: number
  inhaled_pm25_ug: number
  category: string
  is_recommended: boolean
  coordinates: [number, number][]
  segments: RouteSegment[]
  key_advantages: string[]
}

export type CleanRouteResponse = {
  origin: Location
  origin_name?: string | null
  destination: Location
  destination_name?: string | null
  mode: 'driving' | 'cycling' | 'walking'
  savings_percent: number
  time_difference_min: number
  fastest_route: EvaluatedRoute
  cleanest_route: EvaluatedRoute
  health_verdict: string
  mask_recommendation: string
  generated_at: string
}

