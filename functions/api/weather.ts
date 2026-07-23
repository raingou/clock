interface PagesFunctionContext {
  request: Request
  env: {
    VISUAL_CROSSING_API_KEY?: string
  }
}

interface VisualCrossingConditions {
  datetime?: string
  temp?: number
  tempmax?: number
  tempmin?: number
  feelslike?: number
  humidity?: number
  precip?: number
  precipprob?: number
  windspeed?: number
  icon?: string
  uvindex?: number
  sunriseEpoch?: number
  sunsetEpoch?: number
}

interface VisualCrossingResponse {
  currentConditions?: VisualCrossingConditions
  days?: VisualCrossingConditions[]
}

function json(data: unknown, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  })
}

function toWmoCode(icon = ''): number {
  const iconMap: Record<string, number> = {
    'clear-day': 0,
    'clear-night': 0,
    'partly-cloudy-day': 2,
    'partly-cloudy-night': 2,
    'cloudy': 3,
    'fog': 45,
    'wind': 3,
    'rain': 63,
    'showers-day': 80,
    'showers-night': 80,
    'snow': 73,
    'snow-showers-day': 85,
    'snow-showers-night': 85,
    'thunder-rain': 95,
    'thunder-showers-day': 95,
    'thunder-showers-night': 95,
    'hail': 96,
  }

  return iconMap[icon] ?? 3
}

function validCoordinate(value: string | null, min: number, max: number) {
  if (value === null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null
}

export async function onRequestGet({ request, env }: PagesFunctionContext) {
  const requestUrl = new URL(request.url)
  const lat = validCoordinate(requestUrl.searchParams.get('lat'), -90, 90)
  const lon = validCoordinate(requestUrl.searchParams.get('lon'), -180, 180)

  if (lat === null || lon === null) {
    return json({ error: 'Invalid latitude or longitude' }, 400)
  }

  if (!env.VISUAL_CROSSING_API_KEY) {
    return json({ error: 'Weather provider is not configured' }, 503)
  }

  const location = encodeURIComponent(`${lat},${lon}`)
  const params = new URLSearchParams({
    unitGroup: 'metric',
    include: 'current,days',
    contentType: 'json',
    iconSet: 'icons2',
    key: env.VISUAL_CROSSING_API_KEY,
  })
  const providerUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${location}?${params}`

  try {
    const response = await fetch(providerUrl)
    if (!response.ok) {
      return json({ error: `Weather provider returned ${response.status}` }, 502)
    }

    const source = await response.json() as VisualCrossingResponse
    const current = source.currentConditions
    const days = source.days?.slice(0, 5) ?? []

    if (!current || days.length === 0) {
      return json({ error: 'Weather provider returned incomplete data' }, 502)
    }

    const nowEpoch = Math.floor(Date.now() / 1000)
    const today = days[0]
    const isDay = current.icon?.includes('night')
      ? 0
      : current.icon?.includes('day')
        ? 1
        : today.sunriseEpoch && today.sunsetEpoch && nowEpoch >= today.sunriseEpoch && nowEpoch < today.sunsetEpoch
          ? 1
          : 0

    return json({
      provider: 'visual-crossing',
      current: {
        temperature_2m: current.temp ?? 0,
        rain: current.precip ?? 0,
        wind_speed_10m: current.windspeed ?? 0,
        is_day: isDay,
        apparent_temperature: current.feelslike ?? current.temp ?? 0,
        showers: current.precip ?? 0,
        relative_humidity_2m: current.humidity ?? 0,
        precipitation: current.precip ?? 0,
        weather_code: toWmoCode(current.icon),
      },
      hourly: {
        precipitation_probability: [current.precipprob ?? today.precipprob ?? 0],
        uv_index: [current.uvindex ?? today.uvindex ?? 0],
        temperature_2m: [current.temp ?? 0],
      },
      daily: {
        time: days.map(day => day.datetime ?? ''),
        weather_code: days.map(day => toWmoCode(day.icon)),
        temperature_2m_max: days.map(day => day.tempmax ?? day.temp ?? 0),
        temperature_2m_min: days.map(day => day.tempmin ?? day.temp ?? 0),
        precipitation_probability_max: days.map(day => day.precipprob ?? 0),
      },
      current_hour_index: 0,
    }, 200, 'public, max-age=600')
  }
  catch (error) {
    console.error('Visual Crossing request failed:', error)
    return json({ error: 'Weather provider request failed' }, 502)
  }
}
