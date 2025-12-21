<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning } from 'lucide-vue-next';
import { mapWmoCode, weatherIcons } from '../utils/weather';
import type { WeatherInfo } from '../types';

const weatherData = ref<any>(null);
const loading = ref(true);
const locationText = ref('定位中...');
const weatherInfo = ref<WeatherInfo>({ text: '点击刷新', type: 'sunny' });

const iconMap: Record<string, any> = {
  sun: Sun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-snow': CloudSnow,
  'cloud-lightning': CloudLightning
};

async function fetchWeather(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    weatherData.value = data;
    weatherInfo.value = mapWmoCode(data.current_weather.weathercode);
    loading.value = false;
    
    if (locationText.value.includes('定位中')) {
      locationText.value = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    }
  } catch (error) {
    weatherInfo.value.text = "接口错误";
  }
}

async function fetchByIp() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    locationText.value = `${data.city}, ${data.country_code}`;
    await fetchWeather(data.latitude, data.longitude);
  } catch (e) {
    locationText.value = "北京市 (默认)";
    await fetchWeather(39.9, 116.4);
  }
}

async function getLocationAndWeather() {
  loading.value = true;
  try {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (p) => await fetchWeather(p.coords.latitude, p.coords.longitude),
        async () => await fetchByIp(),
        { timeout: 5000 }
      );
    } else {
      await fetchByIp();
    }
  } catch (err) {
    weatherInfo.value.text = "更新超时";
    loading.value = false;
  }
}

let weatherTimer: number;

onMounted(() => {
  getLocationAndWeather();
  weatherTimer = window.setInterval(getLocationAndWeather, 20 * 60 * 1000);
});

onUnmounted(() => {
  clearInterval(weatherTimer);
});
</script>

<template>
  <div 
    id="weather-container" 
    @click="getLocationAndWeather"
    class="weather-clickable grid grid-cols-1 md:grid-cols-3 gap-10 w-full border-t border-white/5 pt-10 transition-opacity duration-700"
    :class="{ 'opacity-30': loading, 'opacity-100': !loading }"
  >
    <!-- 状态与定位 -->
    <div class="flex items-center justify-center md:justify-start gap-6">
      <div id="weather-icon" class="w-24 h-24 float-anim text-white/90">
        <component :is="iconMap[weatherIcons[weatherInfo.type]]" class="w-full h-full" />
      </div>
      <div>
        <p id="weather-text" class="text-4xl font-semibold tracking-wide">{{ weatherInfo.text }}</p>
        <p id="location-text" class="text-md opacity-40 uppercase tracking-widest mt-1">{{ locationText }}</p>
      </div>
    </div>

    <!-- 温度显示（含最高/最低） -->
    <div class="flex items-center justify-center border-x border-white/5 px-6 gap-6">
      <div class="flex items-end">
        <div class="text-8xl font-extralight mr-1" id="temp-val">
          {{ weatherData ? Math.round(weatherData.current_weather.temperature) : '--' }}
        </div>
        <div class="text-3xl font-light opacity-70 mb-12">°C</div>
      </div>
      <div class="flex flex-col items-center justify-between gap-2">
        <span id="temp-max" class="text-3xl font-medium text-red-200">
          {{ weatherData ? Math.round(weatherData.daily.temperature_2m_max[0]) : '--' }}°
        </span>
        <span id="temp-min" class="text-3xl font-medium text-blue-200">
          {{ weatherData ? Math.round(weatherData.daily.temperature_2m_min[0]) : '--' }}°
        </span>
      </div>
    </div>

    <!-- 环境数据 -->
    <div class="flex flex-col justify-center items-center md:items-end">
      <p class="text-lg font-medium tracking-tight">
        <span id="humidity-val" class="text-white text-4xl">
          {{ weatherData ? weatherData.hourly.relativehumidity_2m[0] : '--' }}%
        </span> 
        <span class="opacity-50 tracking-widest">湿度</span>
      </p>
      <p class="text-lg font-medium tracking-tight mt-1">
        <span id="wind-val" class="text-white text-4xl">
          {{ weatherData ? weatherData.current_weather.windspeed : '--' }} km/h
        </span> 
        <span class="opacity-50 tracking-widest"> 风速</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.weather-clickable {
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.5s ease;
  padding: 1rem;
}
.weather-clickable:active {
  transform: scale(0.98);
  background: rgba(255, 255, 255, 0.03);
}
</style>
