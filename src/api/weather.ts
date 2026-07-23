import type { AirQualityApiResponse, WeatherApiResponse } from './types'

async function fetchOpenMeteoWeather(lat: number, lon: number): Promise<WeatherApiResponse> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain,wind_speed_10m,is_day,apparent_temperature,showers,relative_humidity_2m,precipitation,weather_code&hourly=precipitation_probability,uv_index,temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.statusText}`)
  }

  const data = await response.json() as WeatherApiResponse
  data.current_hour_index = new Date().getHours()
  data.provider = 'open-meteo'
  return data
}

export async function fetchWeatherData(lat: number, lon: number): Promise<WeatherApiResponse> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  })

  try {
    const response = await fetch(`/api/weather?${params}`)
    if (!response.ok) {
      throw new Error(`Visual Crossing proxy error: ${response.status}`)
    }
    return await response.json() as WeatherApiResponse
  }
  catch (error) {
    console.warn('Visual Crossing unavailable, falling back to Open-Meteo:', error)
    return fetchOpenMeteoWeather(lat, lon)
  }
}

export async function fetchAirQualityData(lat: number, lon: number): Promise<AirQualityApiResponse> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Air Quality API error: ${response.statusText}`)
  }

  const data = await response.json() as AirQualityApiResponse
  return data
}
