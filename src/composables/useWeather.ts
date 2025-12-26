import type { WeatherInfo } from '../types'
import { ref, watch } from 'vue'
import { mapWmoCode } from '../utils/weather'

const weatherData = ref<any>(null)
const loading = ref(true)
const locationText = ref('定位中...')
const weatherInfo = ref<WeatherInfo>({ text: '点击刷新', icon: mapWmoCode(-1).icon })
const cachedCoords = ref<{ lat: number, lon: number, city: string } | null>(null)

// --- Settings State ---
export type LocationMode = 'auto' | 'coords' | 'city'
const locationMode = ref<LocationMode>(localStorage.getItem('weather_location_mode') as LocationMode || 'auto')
const customLat = ref(Number(localStorage.getItem('weather_custom_lat')) || 39.9)
const customLon = ref(Number(localStorage.getItem('weather_custom_lon')) || 116.4)
const customCity = ref(localStorage.getItem('weather_custom_city') || '北京市')
const refreshInterval = ref(Number(localStorage.getItem('weather_refresh_interval')) || 20)

// Effects visibility toggles
const showRainEffect = ref(localStorage.getItem('weather_show_rain') !== 'false')
const showThunderEffect = ref(localStorage.getItem('weather_show_thunder') !== 'false')
const showSnowEffect = ref(localStorage.getItem('weather_show_snow') !== 'false')

async function fetchWeather(lat: number, lon: number, locationName?: string, isRealLocation: boolean = false) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain,wind_speed_10m,is_day,apparent_temperature,showers,relative_humidity_2m,precipitation,weather_code&hourly=precipitation_probability,uv_index,temperature_2m&timezone=auto&forecast_days=1`
  try {
    const response = await fetch(url)
    const data = await response.json()

    const currentHour = new Date().getHours()
    data.current_hour_index = currentHour

    weatherData.value = data
    weatherInfo.value = mapWmoCode(data.current.weather_code, data.current.is_day === 1)
    loading.value = false

    if (locationName) {
      locationText.value = locationName
      if (isRealLocation) {
        cachedCoords.value = { lat, lon, city: locationName }
      }
    }
    else if (locationText.value.includes('定位中')) {
      locationText.value = `${lon.toFixed(2)}, ${lat.toFixed(2)}`
    }
  }
  catch (error) {
    weatherInfo.value.text = '接口错误'
    weatherInfo.value.icon = mapWmoCode(-1).icon
  }
}

async function fetchByCity(cityName: string) {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=zh&format=json`)
    const data = await res.json()
    if (data.results && data.results.length > 0) {
      const { latitude, longitude, name } = data.results[0]
      await fetchWeather(latitude, longitude, name, true)
    }
    else {
      throw new Error('找不到城市')
    }
  }
  catch (e) {
    weatherInfo.value.text = '城市错误'
    loading.value = false
  }
}

async function reverseGeocode(lat: number, lon: number) {
  try {
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`)
    const data = await response.json()
    const city = data.city || data.locality || data.principalSubdivision || '未知城市'
    return city
  }
  catch (e) {
    return `${lon.toFixed(2)}, ${lat.toFixed(2)}`
  }
}

async function fetchByIp() {
  try {
    const res = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=zh')
    const data = await res.json()
    if (data.latitude && data.longitude) {
      const city = data.city || data.locality || data.principalSubdivision || '未知城市'
      await fetchWeather(data.latitude, data.longitude, city, true)
    }
    else {
      throw new Error('定位失败')
    }
  }
  catch (e) {
    await fetchWeather(39.9, 116.4, '北京市 (默认)')
  }
}

async function getLocationAndWeather() {
  loading.value = true

  if (locationMode.value === 'coords') {
    const city = await reverseGeocode(customLat.value, customLon.value)
    await fetchWeather(customLat.value, customLon.value, city)
    return
  }

  if (locationMode.value === 'city') {
    await fetchByCity(customCity.value)
    return
  }

  // Auto mode
  // 只有在模式确实为 auto 且有缓存时才使用缓存
  if (locationMode.value === 'auto' && cachedCoords.value) {
    const { lat, lon, city } = cachedCoords.value
    await fetchWeather(lat, lon, city, true)
    return
  }

  locationText.value = '定位中...'

  try {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          const lat = p.coords.latitude
          const lon = p.coords.longitude
          const city = await reverseGeocode(lat, lon)
          await fetchWeather(lat, lon, city, true)
        },
        async () => await fetchByIp(),
        { timeout: 5000 },
      )
    }
    else {
      await fetchByIp()
    }
  }
  catch (err) {
    weatherInfo.value.text = '更新超时'
    loading.value = false
  }
}

// 模式切换时清空自动定位缓存并重置显示文本
watch(locationMode, (newMode) => {
  if (newMode === 'auto') {
    cachedCoords.value = null
    locationText.value = '定位中...'
  }
}, { flush: 'sync' })

export function useWeather() {
  function saveSettings() {
    localStorage.setItem('weather_location_mode', locationMode.value)
    localStorage.setItem('weather_custom_lat', customLat.value.toString())
    localStorage.setItem('weather_custom_lon', customLon.value.toString())
    localStorage.setItem('weather_custom_city', customCity.value)
    localStorage.setItem('weather_refresh_interval', refreshInterval.value.toString())
    localStorage.setItem('weather_show_rain', showRainEffect.value.toString())
    localStorage.setItem('weather_show_thunder', showThunderEffect.value.toString())
    localStorage.setItem('weather_show_snow', showSnowEffect.value.toString())
  }

  return {
    weatherData,
    loading,
    locationText,
    weatherInfo,
    locationMode,
    customLat,
    customLon,
    customCity,
    refreshInterval,
    showRainEffect,
    showThunderEffect,
    showSnowEffect,
    saveSettings,
    getLocationAndWeather,
  }
}
