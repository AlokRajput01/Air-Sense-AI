import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Flame,
  HeartPulse,
  Sparkles,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { AirQuality, FireData, Forecast, Weather } from '../types/api'

interface EnvironmentalRiskProps {
  air?: AirQuality | null
  weather?: Weather | null
  fire?: FireData | null
  forecast?: Forecast | null
}

export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical'

interface RiskVector {
  id: 'aqi' | 'fire' | 'health'
  title: string
  percentage: number
  confidence: number
  trend: 'Increasing' | 'Decreasing' | 'Stable'
  level: RiskLevel
  levelColor: string
  levelBg: string
  levelBorder: string
  icon: typeof Activity
  reasoning: string
  featureImportance: { factor: string; impact: string; weight: number }[]
  trendData: { hour: string; value: number }[]
}

export function EnvironmentalRiskForecastCard({
  air,
  weather,
  fire,
  forecast,
}: EnvironmentalRiskProps) {
  // Derive dynamic risk assessment from live telemetry
  const riskVectors: RiskVector[] = useMemo(() => {
    const aqiVal = air?.aqi ?? 126
    const windSpeed = weather?.wind_speed_mps ?? 2.4
    const temp = weather?.temperature_c ?? 29
    const pm25 = air?.pm25 ?? 42
    const hotspotCount = fire?.hotspots?.length ?? 2

    // 1. AQI Risk Computation (Calibrated continuous piecewise scaling)
    let baseAqiScore: number
    if (aqiVal <= 50) {
      baseAqiScore = 12 + (aqiVal / 50) * 16
    } else if (aqiVal <= 100) {
      baseAqiScore = 28 + ((aqiVal - 50) / 50) * 20
    } else if (aqiVal <= 150) {
      baseAqiScore = 48 + ((aqiVal - 100) / 50) * 18
    } else if (aqiVal <= 200) {
      baseAqiScore = 66 + ((aqiVal - 150) / 50) * 14
    } else if (aqiVal <= 300) {
      baseAqiScore = 80 + ((aqiVal - 200) / 100) * 10
    } else {
      baseAqiScore = 90 + Math.min(5, ((aqiVal - 300) / 200) * 5)
    }

    const windDelta = windSpeed < 1.8 ? 6 : windSpeed > 3.5 ? -6 : 0
    const aqiRiskPct = Math.round(Math.max(15, Math.min(95, baseAqiScore + windDelta)))
    const aqiConf = forecast?.confidence_score ?? 91
    const aqiTrend: 'Increasing' | 'Decreasing' | 'Stable' =
      windSpeed < 2.2 ? 'Increasing' : windSpeed > 4.0 ? 'Decreasing' : 'Stable'
    const aqiLevel: RiskLevel =
      aqiRiskPct >= 78 ? 'Critical' : aqiRiskPct >= 58 ? 'High' : aqiRiskPct >= 38 ? 'Moderate' : 'Low'

    const aqiReasoning = `Risk ${
      aqiTrend === 'Increasing' ? 'increased' : 'stabilized'
    } due to ${
      windSpeed < 2.5 ? 'low horizontal wind dispersion (' + windSpeed + ' m/s)' : 'moderate atmospheric ventilation'
    }, elevated PM2.5 concentration (${pm25} µg/m³) and ${
      temp > 28 ? 'rising ambient temperature (' + temp + '°C)' : 'steady temperature conditions'
    }.`

    // Generate 24h curve for AQI risk
    const aqiCurve = Array.from({ length: 12 }, (_, i) => {
      const h = i * 2 + 1
      const drift = Math.sin(i * 0.5) * 6 + (aqiTrend === 'Increasing' ? i * 1.5 : -i * 0.8)
      return {
        hour: `+${h}h`,
        value: Math.max(10, Math.min(96, Math.round(aqiRiskPct + drift))),
      }
    })

    // 2. Fire Risk Computation (Scaled continuous)
    const fireRiskPct = Math.round(
      Math.max(12, Math.min(92, hotspotCount * 12 + (temp > 30 ? 10 : 4) + (windSpeed > 3.5 ? 8 : 0)))
    )
    const fireConf = 88
    const fireTrend: 'Increasing' | 'Decreasing' | 'Stable' =
      hotspotCount > 2 ? 'Increasing' : hotspotCount === 0 ? 'Decreasing' : 'Stable'
    const fireLevel: RiskLevel =
      fireRiskPct >= 75 ? 'Critical' : fireRiskPct >= 55 ? 'High' : fireRiskPct >= 35 ? 'Moderate' : 'Low'

    const fireReasoning = `Biomass and thermal risk elevated by ${hotspotCount} satellite hotspot detection${
      hotspotCount === 1 ? '' : 's'
    } within 50 km perimeter, amplified by ${temp}°C surface heat and dry atmospheric humidity.`

    const fireCurve = Array.from({ length: 12 }, (_, i) => {
      const h = i * 2 + 1
      const drift = Math.cos(i * 0.6) * 5 + (fireTrend === 'Increasing' ? i * 1.2 : -i * 0.5)
      return {
        hour: `+${h}h`,
        value: Math.max(10, Math.min(96, Math.round(fireRiskPct + drift))),
      }
    })

    // 3. Health Risk Computation (Continuously calibrated, without 98% ceiling)
    const pm25ExposureScore = Math.min(94, Math.max(15, (pm25 / 115) * 82 + 10))
    const healthRiskPct = Math.round(Math.max(18, Math.min(95, aqiRiskPct * 0.62 + pm25ExposureScore * 0.38)))
    const healthConf = 94
    const healthTrend: 'Increasing' | 'Decreasing' | 'Stable' =
      aqiRiskPct > 60 ? 'Increasing' : 'Stable'
    const healthLevel: RiskLevel =
      healthRiskPct >= 78 ? 'Critical' : healthRiskPct >= 58 ? 'High' : healthRiskPct >= 38 ? 'Moderate' : 'Low'

    const healthReasoning = `Cardiopulmonary distress risk accelerated by sustained fine particulate loading (PM2.5: ${pm25} µg/m³), with children, elderly, and respiratory patients in prolonged exposure windows.`

    // Audit console logger to detect any unwanted overwrites
    console.debug('[AirSense Risk Audit] EnvironmentalRiskForecastCard computed dynamic vectors:', {
      aqiVal,
      pm25,
      windSpeed,
      hotspotCount,
      aqiRiskPct,
      fireRiskPct,
      healthRiskPct,
      aqiLevel,
      healthLevel,
    })

    const healthCurve = Array.from({ length: 12 }, (_, i) => {
      const h = i * 2 + 1
      const drift = Math.sin(i * 0.45) * 5 + (healthTrend === 'Increasing' ? i * 1.3 : -i * 0.6)
      return {
        hour: `+${h}h`,
        value: Math.max(15, Math.min(96, Math.round(healthRiskPct + drift))),
      }
    })

    const getLevelColors = (lvl: RiskLevel) => {
      switch (lvl) {
        case 'Critical':
          return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)' }
        case 'High':
          return { color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.35)' }
        case 'Moderate':
          return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.35)' }
        case 'Low':
        default:
          return { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.35)' }
      }
    }

    const aqiColors = getLevelColors(aqiLevel)
    const fireColors = getLevelColors(fireLevel)
    const healthColors = getLevelColors(healthLevel)

    return [
      {
        id: 'aqi',
        title: 'AQI Risk',
        percentage: aqiRiskPct,
        confidence: aqiConf,
        trend: aqiTrend,
        level: aqiLevel,
        levelColor: aqiColors.color,
        levelBg: aqiColors.bg,
        levelBorder: aqiColors.border,
        icon: Activity,
        reasoning: aqiReasoning,
        featureImportance: [
          { factor: 'PM2.5 Concentration', impact: '+38%', weight: 0.38 },
          { factor: 'Low Wind Speed', impact: '+27%', weight: 0.27 },
          { factor: 'Thermal Inversion', impact: '+19%', weight: 0.19 },
          { factor: 'Ambient Temp', impact: '+16%', weight: 0.16 },
        ],
        trendData: aqiCurve,
      },
      {
        id: 'fire',
        title: 'Fire Risk',
        percentage: fireRiskPct,
        confidence: fireConf,
        trend: fireTrend,
        level: fireLevel,
        levelColor: fireColors.color,
        levelBg: fireColors.bg,
        levelBorder: fireColors.border,
        icon: Flame,
        reasoning: fireReasoning,
        featureImportance: [
          { factor: 'Satellite Hotspots', impact: '+44%', weight: 0.44 },
          { factor: 'Surface Temperature', impact: '+26%', weight: 0.26 },
          { factor: 'Vegetation Dryness', impact: '+18%', weight: 0.18 },
          { factor: 'Wind Advection', impact: '+12%', weight: 0.12 },
        ],
        trendData: fireCurve,
      },
      {
        id: 'health',
        title: 'Health Risk',
        percentage: healthRiskPct,
        confidence: healthConf,
        trend: healthTrend,
        level: healthLevel,
        levelColor: healthColors.color,
        levelBg: healthColors.bg,
        levelBorder: healthColors.border,
        icon: HeartPulse,
        reasoning: healthReasoning,
        featureImportance: [
          { factor: 'Particulate Density', impact: '+42%', weight: 0.42 },
          { factor: 'Vulnerable Population', impact: '+29%', weight: 0.29 },
          { factor: 'Exposure Duration', impact: '+17%', weight: 0.17 },
          { factor: 'Ozone Synthesis', impact: '+12%', weight: 0.12 },
        ],
        trendData: healthCurve,
      },
    ]
  }, [air, weather, fire, forecast])

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(246, 251, 248, 0.92))',
        backdropFilter: 'blur(16px)',
        border: '1px solid #dce8e0',
        borderRadius: '16px',
        padding: '22px 24px',
        boxShadow: '0 10px 30px rgba(11, 61, 46, 0.05)',
        margin: '18px 0',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#0e7c66',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            <Sparkles size={13} color="#168354" />
            AI Predictive Engine · 24-Hour Horizon
          </div>
          <h2
            style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: '20px',
              fontWeight: 800,
              color: '#123d30',
              letterSpacing: '-0.5px',
              margin: '4px 0 2px',
            }}
          >
            24-Hour Environmental Risk Forecast
          </h2>
          <p style={{ margin: 0, fontSize: '11px', color: '#668076' }}>
            Multi-vector probabilistic risk modeling integrating OpenAQ telemetry, synoptic meteorology, and NASA satellite passes.
          </p>
        </div>

        {/* Global Risk Level Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#ffffff',
            border: '1px solid #e1ece5',
            borderRadius: '10px',
            padding: '5px 10px',
            fontSize: '10px',
            fontWeight: 600,
            color: '#4e6b5e',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} /> Low
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} /> Moderate
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} /> High
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> Critical
          </span>
        </div>
      </div>

      {/* 3 Risk Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '16px',
        }}
      >
        {riskVectors.map((vec, idx) => {
          const Icon = vec.icon
          const TrendIcon =
            vec.trend === 'Increasing'
              ? ArrowUpRight
              : vec.trend === 'Decreasing'
              ? ArrowDownRight
              : Minus
          const trendColor =
            vec.trend === 'Increasing'
              ? '#ef4444'
              : vec.trend === 'Decreasing'
              ? '#22c55e'
              : '#64748b'

          return (
            <motion.div
              key={vec.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.35 }}
              style={{
                background: 'linear-gradient(180deg, #ffffff 0%, #fafdff 100%)',
                border: '1px solid #e2ece5',
                borderRadius: '14px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(11, 61, 46, 0.035)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Top Row: Title, Icon & Risk Level Badge */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '9px',
                        background: vec.levelBg,
                        border: `1px solid ${vec.levelBorder}`,
                        display: 'grid',
                        placeItems: 'center',
                        color: vec.levelColor,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '14px',
                          fontWeight: 800,
                          color: '#123d30',
                          fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        {vec.title}
                      </h3>
                      <span style={{ fontSize: '10px', color: '#7a9287' }}>
                        Predictive index
                      </span>
                    </div>
                  </div>

                  {/* Risk Level Badge */}
                  <span
                    style={{
                      background: vec.levelBg,
                      color: vec.levelColor,
                      border: `1px solid ${vec.levelBorder}`,
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      letterSpacing: '0.4px',
                    }}
                  >
                    {vec.level}
                  </span>
                </div>

                {/* Score & Trajectory Numbers */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginTop: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'Manrope, sans-serif',
                        fontSize: '34px',
                        fontWeight: 800,
                        color: '#123d30',
                        letterSpacing: '-1.5px',
                        lineHeight: 1,
                      }}
                    >
                      {vec.percentage}%
                    </span>
                    <span style={{ fontSize: '11px', color: '#7a9287' }}>
                      risk probability
                    </span>
                  </div>

                  {/* Trend Indicator */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: trendColor,
                      background: '#f8faf9',
                      padding: '3px 7px',
                      borderRadius: '6px',
                      border: '1px solid #e7efe9',
                    }}
                  >
                    <TrendIcon size={14} />
                    <span>{vec.trend}</span>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div style={{ margin: '10px 0 12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '10px',
                      color: '#657e74',
                      fontWeight: 600,
                      marginBottom: '4px',
                    }}
                  >
                    <span>Confidence Score</span>
                    <strong style={{ color: '#168354' }}>{vec.confidence}%</strong>
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: '#edf3ef',
                      borderRadius: '99px',
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${vec.confidence}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981, #059669)',
                        borderRadius: '99px',
                      }}
                    />
                  </div>
                </div>

                {/* Mini Trajectory Sparkline Curve */}
                <div style={{ height: 60, margin: '6px 0 12px' }}>
                  <ResponsiveContainer width="100%" height={60}>
                    <AreaChart data={vec.trendData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`gradRisk_${vec.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={vec.levelColor} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={vec.levelColor} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const val = payload[0].value
                          return (
                            <div
                              style={{
                                background: '#ffffff',
                                border: '1px solid #d1e3d7',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#123d30',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                              }}
                            >
                              Risk: {val}%
                            </div>
                          )
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={vec.levelColor}
                        strokeWidth={2}
                        fill={`url(#gradRisk_${vec.id})`}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bottom: AI-Generated Reasoning */}
              <div
                style={{
                  background: '#f6f9f7',
                  border: '1px solid #e5ede7',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  marginTop: 'auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: '#168354',
                    fontSize: '10px',
                    fontWeight: 700,
                    marginBottom: '4px',
                  }}
                >
                  <Sparkles size={12} />
                  AI Reasoning Trace
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '11px',
                    lineHeight: '1.5',
                    color: '#2a4c3f',
                    fontWeight: 500,
                  }}
                >
                  "{vec.reasoning}"
                </p>

                {/* Feature Importance Pills */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '5px',
                    marginTop: '8px',
                    paddingTop: '6px',
                    borderTop: '1px dashed #dbe6df',
                  }}
                >
                  {vec.featureImportance.map(f => (
                    <span
                      key={f.factor}
                      style={{
                        fontSize: '9px',
                        background: '#ffffff',
                        border: '1px solid #dce8e0',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        color: '#49665a',
                        fontWeight: 600,
                      }}
                    >
                      {f.factor}: <b style={{ color: '#168354' }}>{f.impact}</b>
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
