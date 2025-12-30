<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CalendarView from './components/CalendarView.vue'
import ClockWeather from './components/ClockWeather.vue'
import NewYearEgg from './components/NewYearEgg.vue'
import SmartHome from './components/SmartHome.vue'
import WeatherEffects from './components/WeatherEffects.vue'
import { useWeatherStore } from './stores/weather'

const currentPage = ref(1)
const smartHomeRef = ref<any>(null)
const calendarRef = ref<any>(null)

const weatherStore = useWeatherStore()
const { weatherData, showRainEffect, showThunderEffect, showSnowEffect } = storeToRefs(weatherStore)

// 判断是否需要渲染天气特效组件
const shouldShowWeatherEffects = computed(() => {
  if (!weatherData.value) return false

  const code = weatherData.value.current?.weather_code ?? -1

  if (showRainEffect.value) {
    const isRaining = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)
    if (isRaining) return true
  }

  if (showSnowEffect.value) {
    const isSnowing = (code >= 71 && code <= 77) || (code === 85 || code === 86)
    if (isSnowing) return true
  }

  if (showThunderEffect.value) {
    const isThundering = code === 95 || code === 96 || code === 99
    if (isThundering) return true
  }

  return false
})

let startX = 0
let autoReturnTimer: number | null = null

function resetAutoReturnTimer() {
  if (autoReturnTimer) {
    clearTimeout(autoReturnTimer)
    autoReturnTimer = null
  }

  if (currentPage.value !== 1) {
    autoReturnTimer = window.setTimeout(() => {
      goToPage(1)
    }, 30000) // 30 seconds
  }
}

function goToPage(page: number) {
  currentPage.value = page
  resetAutoReturnTimer()

  // 切换到智能首页 (page 0) 时更新状态
  if (page === 0 && smartHomeRef.value) {
    smartHomeRef.value.updateAllStates()
  }

  // 切换到日历看板 (page 2) 时更新当前日期
  if (page === 2 && calendarRef.value) {
    calendarRef.value.refreshToday()
  }
}

function handleTouchStart(e: TouchEvent) {
  startX = e.touches[0].clientX
  resetAutoReturnTimer()
}

function handleTouchEnd(e: TouchEvent) {
  const endX = e.changedTouches[0].clientX
  const diff = startX - endX
  if (Math.abs(diff) > 50) {
    if (diff > 0 && currentPage.value < 2)
      goToPage(currentPage.value + 1)
    else if (diff < 0 && currentPage.value > 0)
      goToPage(currentPage.value - 1)
  }
}

function handleMouseDown(e: MouseEvent) {
  startX = e.clientX
  resetAutoReturnTimer()
}

function handleMouseUp(e: MouseEvent) {
  const diff = startX - e.clientX
  if (Math.abs(diff) > 50) {
    if (diff > 0 && currentPage.value < 2)
      goToPage(currentPage.value + 1)
    else if (diff < 0 && currentPage.value > 0)
      goToPage(currentPage.value - 1)
  }
}


onMounted(() => {
  window.addEventListener('keydown', resetAutoReturnTimer)
  window.addEventListener('click', resetAutoReturnTimer)
})

onUnmounted(() => {
  window.removeEventListener('keydown', resetAutoReturnTimer)
  window.removeEventListener('click', resetAutoReturnTimer)
  if (autoReturnTimer)
    clearTimeout(autoReturnTimer)
})
</script>

<template>
  <div
    class="viewport-container overflow-hidden relative w-screen h-screen bg-black"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
  >
    <div
      class="main-slider flex h-full transition-transform duration-700 cubic-bezier"
      :style="{ transform: `translateX(-${currentPage * 100}vw)`, width: '300vw' }"
    >
      <div class="slide-page w-screen h-screen flex items-center justify-center flex-shrink-0">
        <SmartHome ref="smartHomeRef" />
      </div>
      <div class="slide-page w-screen h-screen flex items-center justify-center flex-shrink-0">
        <ClockWeather />
      </div>
      <div class="slide-page w-screen h-screen flex items-center justify-center flex-shrink-0">
        <CalendarView ref="calendarRef" />
      </div>
    </div>

    <!-- 元旦彩蛋：独立模块，可随时移除 -->
    <NewYearEgg />

    <WeatherEffects v-if="shouldShowWeatherEffects" />
  </div>
</template>

<style scoped>
.cubic-bezier {
  transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
}
</style>
