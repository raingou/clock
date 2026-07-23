<script setup lang="ts">
import type { Anniversary, LunarInfo } from '../types'
import { onClickOutside, useIdle } from '@vueuse/core'
import { ChevronLeft, ChevronRight, Settings } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AlmanacModal from '../components/AlmanacModal.vue'
import { useConfigStore } from '../stores/config'
import { getAlmanacDetails, getLunarDate } from '../utils/lunar'
import { getPublicHolidays } from '../utils/publicHolidays'
import type { HolidayCountry, PublicHoliday } from '../utils/publicHolidays'

const configStore = useConfigStore()
const { calendarConfig, showDrawer, activeTab } = storeToRefs(configStore)
const { t, locale } = useI18n()

const currentMonthDate = ref(new Date())
const today = ref(new Date())
const remoteHolidayMap = ref<Record<string, Array<{ code: string, name: string }>>>({})
const showSettingsButton = ref(true)
const showDesktopMonthPicker = ref(false)
const desktopMonthPickerRef = ref<HTMLElement | null>(null)
const pickerYear = ref(currentMonthDate.value.getFullYear())
const monthTransitionDirection = ref<'up' | 'down'>('up')
const { idle } = useIdle(5 * 1000)
let holidayRequestId = 0
let calendarTouchStartX = 0
let calendarTouchStartY = 0
let monthSwipeLockedUntil = 0
let suppressDayClickUntil = 0

watch(idle, (isIdle) => {
  showSettingsButton.value = !isIdle
})

onClickOutside(desktopMonthPickerRef, () => {
  showDesktopMonthPicker.value = false
})

function openSettings() {
  activeTab.value = 'calendar'
  showDrawer.value = true
}

const selectedDay = ref<{
  date: Date
  lunar: LunarInfo
  anniversaries: Anniversary[]
  holidays: Array<{ code: string, name: string }>
} | null>(null)

const year = computed(() => currentMonthDate.value.getFullYear())
const month = computed(() => currentMonthDate.value.getMonth())

const isCurrentMonth = computed(() => {
  return year.value === today.value.getFullYear() && month.value === today.value.getMonth()
})

const calendarDays = computed(() => {
  const y = year.value
  const m = month.value
  const weekStartDay = calendarConfig.value.weekStartDay // 0: Sunday, 1: Monday

  // 获取本月第一天是周几 (0-6)
  const firstDayOfMonth = new Date(y, m, 1).getDay()

  // 计算需要补齐的上个月天数
  // 如果周一平衡，且第一天是周日(0)，则需要补 6 天
  // 如果周日平衡，且第一天是周日(0)，则需要补 0 天
  let paddingDays = firstDayOfMonth - weekStartDay
  if (paddingDays < 0) paddingDays += 7

  const daysInMonth = new Date(y, m + 1, 0).getDate()

  const days = []

  // Prev month
  for (let i = paddingDays - 1; i >= 0; i--) {
    const d = new Date(y, m, 0 - i) // 这样写比较稳妥，new Date(y, m, 0) 是上月最后一天
    days.push({ date: d, isOtherMonth: true, lunar: getLunarDate(d) })
  }

  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(y, m, i)
    days.push({
      date: d,
      isOtherMonth: false,
      isToday: d.toDateString() === today.value.toDateString(),
      lunar: getLunarDate(d),
    })
  }

  // Next month
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(y, m + 1, i)
    days.push({ date: d, isOtherMonth: true, lunar: getLunarDate(d) })
  }

  return days.map(day => ({
    ...day,
    anniversaries: getAnniversaries(day.date, day.lunar),
    holidays: getHolidayLabels(day.date, day.lunar),
  }))
})

const weekHeaders = computed(() => {
  const headers = [
    t('weekdays.shortSimple.0'),
    t('weekdays.shortSimple.1'),
    t('weekdays.shortSimple.2'),
    t('weekdays.shortSimple.3'),
    t('weekdays.shortSimple.4'),
    t('weekdays.shortSimple.5'),
    t('weekdays.shortSimple.6'),
  ]
  if (calendarConfig.value.weekStartDay === 1) {
    return [headers[1], headers[2], headers[3], headers[4], headers[5], headers[6], headers[0]]
  }
  return headers
})

const monthLabel = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long' })
  return formatter.format(currentMonthDate.value)
})

const monthPickerValue = computed({
  get: () => `${year.value}-${String(month.value + 1).padStart(2, '0')}`,
  set: (value: string) => {
    const match = /^(\d{4})-(\d{2})$/.exec(value)
    if (!match) return
    const selectedYear = Number(match[1])
    const selectedMonth = Number(match[2])
    if (selectedYear < 1900 || selectedYear > 2100 || selectedMonth < 1 || selectedMonth > 12) return
    setCurrentMonth(new Date(selectedYear, selectedMonth - 1, 1))
  },
})

const desktopMonthNames = computed(() => Array.from({ length: 12 }, (_, index) => {
  return new Intl.DateTimeFormat(locale.value, { month: 'short' }).format(new Date(2020, index, 1))
}))

function toggleDesktopMonthPicker() {
  pickerYear.value = year.value
  showDesktopMonthPicker.value = !showDesktopMonthPicker.value
}

function changePickerYear(delta: number) {
  const baseYear = Number.isFinite(pickerYear.value) ? pickerYear.value : year.value
  pickerYear.value = Math.min(2100, Math.max(1900, Math.round(baseYear + delta)))
}

function selectDesktopMonth(selectedMonth: number) {
  const selectedYear = Number.isFinite(pickerYear.value) ? Math.round(pickerYear.value) : year.value
  pickerYear.value = Math.min(2100, Math.max(1900, selectedYear))
  setCurrentMonth(new Date(pickerYear.value, selectedMonth, 1))
  showDesktopMonthPicker.value = false
}

function selectCurrentMonth() {
  goToToday()
  showDesktopMonthPicker.value = false
}

const showLunar = computed(() => locale.value !== 'en-US')
const selectedHolidayCountries = computed(() => calendarConfig.value.holidayCountries || ['CN'])

function getHolidayLabels(date: Date, lunar: LunarInfo) {
  if (!calendarConfig.value.showHolidays) return []
  const labels: Array<{ code: string, name: string }> = []
  if (selectedHolidayCountries.value.includes('CN') && lunar.holiday) {
    labels.push({ code: t('calendar.countryShort.CN'), name: lunar.holiday })
  }
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  labels.push(...(remoteHolidayMap.value[key] || []))
  return labels
}

async function loadRemoteHolidays() {
  const requestId = ++holidayRequestId
  const countries = selectedHolidayCountries.value.filter(code => code !== 'CN') as HolidayCountry[]
  if (!calendarConfig.value.showHolidays || !countries.length) {
    remoteHolidayMap.value = {}
    return
  }

  try {
    const results = await Promise.all(countries.map(async country => ({
      country,
      holidays: await getPublicHolidays(country, year.value),
    })))
    if (requestId !== holidayRequestId) return

    const next: Record<string, Array<{ code: string, name: string }>> = {}
    results.forEach(({ country, holidays }: { country: HolidayCountry, holidays: PublicHoliday[] }) => {
      holidays.forEach((holiday) => {
        if (!next[holiday.date]) next[holiday.date] = []
        next[holiday.date].push({ code: t(`calendar.countryShort.${country}`), name: holiday.name })
      })
    })
    remoteHolidayMap.value = next
  }
  catch (error) {
    console.error('Failed to load public holidays:', error)
    if (requestId === holidayRequestId) remoteHolidayMap.value = {}
  }
}

watch([year, selectedHolidayCountries, () => calendarConfig.value.showHolidays], loadRemoteHolidays, { immediate: true, deep: true })

function getAnniversaries(date: Date, lunar: LunarInfo) {
  return (calendarConfig.value.lunarAnniversaries || []).filter((item) => {
    if (item.calendarType === 'solar') {
      return item.month === date.getMonth() + 1 && item.day === date.getDate()
    }
    // calendarType 缺失时按农历处理，兼容旧版本保存的数据。
    if (item.month !== lunar.monthNumber || item.day !== lunar.dayNumber) return false
    if (item.leapMonth === 'both') return true
    return item.leapMonth === (lunar.isLeapMonth ? 'leap' : 'normal')
  })
}

function setCurrentMonth(nextDate: Date) {
  const currentIndex = currentMonthDate.value.getFullYear() * 12 + currentMonthDate.value.getMonth()
  const nextIndex = nextDate.getFullYear() * 12 + nextDate.getMonth()
  monthTransitionDirection.value = nextIndex < currentIndex ? 'down' : 'up'
  currentMonthDate.value = nextDate
}

function changeMonth(delta: number) {
  const d = new Date(currentMonthDate.value)
  d.setMonth(d.getMonth() + delta)
  setCurrentMonth(d)
}

function handleCalendarTouchStart(event: TouchEvent) {
  if (selectedDay.value || showDrawer.value || showDesktopMonthPicker.value) return
  calendarTouchStartX = event.touches[0].clientX
  calendarTouchStartY = event.touches[0].clientY
}

function handleCalendarTouchEnd(event: TouchEvent) {
  if (selectedDay.value || showDrawer.value || showDesktopMonthPicker.value || Date.now() < monthSwipeLockedUntil) return

  const diffX = calendarTouchStartX - event.changedTouches[0].clientX
  const diffY = calendarTouchStartY - event.changedTouches[0].clientY
  const isVerticalSwipe = Math.abs(diffY) >= 55 && Math.abs(diffY) > Math.abs(diffX) * 1.2
  if (!isVerticalSwipe) return

  event.preventDefault()
  monthSwipeLockedUntil = Date.now() + 280
  suppressDayClickUntil = Date.now() + 350
  changeMonth(diffY > 0 ? 1 : -1)
}

function handleDayClick(day: any) {
  if (Date.now() < suppressDayClickUntil) return
  if (!showLunar.value) return
  selectedDay.value = {
    ...day,
    lunar: {
      ...day.lunar,
      ...getAlmanacDetails(day.date),
    },
  }
}

function goToToday() {
  today.value = new Date()
  setCurrentMonth(new Date())
}

function refreshToday() {
  today.value = new Date()
  // 如果当前正在看“今天”所在的月份，则确保视图也是最新的
  if (isCurrentMonth.value) {
    currentMonthDate.value = new Date()
  }
}

defineExpose({ refreshToday })
</script>

<template>
  <div class="full-screen-calendar text-white">
    <div class="flex items-center justify-between w-full mb-[2vh] px-[2vh]">
      <!-- 手机和平板保留系统原生月份选择器 -->
      <label class="month-picker-native relative text-left cursor-pointer" :aria-label="monthLabel">
        <h2 class="text-[6vh] leading-[6vh] font-bold tracking-widest">
          {{ monthLabel }}
        </h2>
        <input
          v-model="monthPickerValue"
          type="month"
          min="1900-01"
          max="2100-12"
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          :aria-label="monthLabel"
        >
      </label>

      <!-- 桌面端使用与页面一致的深色年月选择面板 -->
      <div ref="desktopMonthPickerRef" class="month-picker-desktop relative text-left">
        <button type="button" class="block" :aria-expanded="showDesktopMonthPicker" @click="toggleDesktopMonthPicker">
          <h2 class="text-[6vh] leading-[6vh] font-bold tracking-widest hover:text-blue-200 transition-colors">
            {{ monthLabel }}
          </h2>
        </button>

        <div
          v-if="showDesktopMonthPicker"
          class="absolute left-0 top-[calc(100%+1rem)] z-50 w-[24rem] rounded-2xl border border-white/15 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-xl"
        >
          <div class="flex items-center justify-between gap-3 mb-4">
            <button type="button" class="month-picker-nav" @click="changePickerYear(-1)">
              <ChevronLeft class="w-5 h-5" />
            </button>
            <input
              v-model.number="pickerYear"
              type="number"
              min="1900"
              max="2100"
              class="w-28 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xl font-semibold text-white outline-none focus:border-blue-300/70"
            >
            <button type="button" class="month-picker-nav" @click="changePickerYear(1)">
              <ChevronRight class="w-5 h-5" />
            </button>
          </div>

          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="(name, index) in desktopMonthNames"
              :key="index"
              type="button"
              class="rounded-xl border px-3 py-3 text-sm font-medium transition-colors"
              :class="pickerYear === year && index === month
                ? 'border-blue-300 bg-blue-400/25 text-blue-100'
                : 'border-white/10 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10'"
              @click="selectDesktopMonth(index)"
            >
              {{ name }}
            </button>
          </div>

          <button
            type="button"
            class="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-blue-300 hover:bg-white/10 transition-colors"
            @click="selectCurrentMonth"
          >
            {{ t('calendar.today') }}
          </button>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <button class="p-[1.1vh] bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition-all duration-300" @click="changeMonth(-1)">
          <ChevronLeft class="w-[3.1vh] h-[3.1vh] " />
        </button>
        <button
          class="px-[2.5vh] py-[1.4vh] bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition-all duration-300 text-[2.2vh] leading-none font-medium"
          @click="goToToday"
        >
          {{ t('calendar.today') }}
        </button>
        <button class="p-[1.1vh] bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition-all duration-300" @click="changeMonth(1)">
          <ChevronRight class="w-[3.1vh] h-[3.1vh] " />
        </button>
        <button
          class="p-[1.1vh] bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition-all duration-300 ml-2"
          :class="{ 'opacity-0 pointer-events-none': !showSettingsButton }"
          @click="openSettings"
        >
          <Settings class="w-[3.1vh] h-[3.1vh]" />
        </button>
      </div>
    </div>

    <div
      class="calendar-swipe-area h-[calc(100vh-13.5vh)] flex flex-col w-full"
      @touchstart="handleCalendarTouchStart"
      @touchend="handleCalendarTouchEnd"
    >
      <div class="grid grid-cols-7 mb-2">
        <div v-for="d in weekHeaders" :key="d" class="calendar-header-day text-[2.6vh] leading-none font-bold">
          {{ d }}
        </div>
      </div>
      <Transition :name="monthTransitionDirection === 'down' ? 'month-slide-down' : 'month-slide-up'" mode="out-in">
        <div :key="monthPickerValue" class="calendar-grid">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            class="calendar-day cursor-pointer hover:bg-white/10 active:scale-95 transition-all duration-200"
            :class="{ 'other-month': day.isOtherMonth, 'today': day.isToday }"
            @click="handleDayClick(day)"
          >
            <div class="day-number-wrapper flex flex-col items-center justify-center overflow-hidden px-2">
              <span class="text-[4vh] leading-none font-bold">{{ day.date.getDate() }}</span>
              <div v-if="showLunar || day.holidays.length" class="lunar-text text-[1.9vh] leading-none font-normal mt-[1vh] text-center line-clamp-1" :title="day.holidays.map(item => `${item.code}·${item.name}`).join(' / ')">
                <span v-if="day.anniversaries.length" class="text-pink-300 opacity-100 font-medium">
                  {{ day.anniversaries.map(item => item.name).join('、') }}
                </span>
                <span
                  v-else-if="showLunar"
                  :class="day.lunar.isFestival ? 'text-blue-300 opacity-100' : 'opacity-60'"
                >
                  {{ day.lunar.festival || (day.lunar.date === '初一' ? `${day.lunar.month}月` : day.lunar.date) }}
                </span>
                <template v-if="day.holidays.length">
                  <span class="opacity-60"> · </span>
                  <span class="text-red-300">
                    {{ day.holidays.map(item => `${item.code}·${item.name}`).join(' / ') }}
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>

  <Teleport to="body">
    <AlmanacModal
      v-if="selectedDay && showLunar"
      :show="!!selectedDay"
      :date="selectedDay.date"
      :lunar="selectedDay.lunar"
      :anniversaries="selectedDay.anniversaries"
      :holidays="selectedDay.holidays"
      @close="selectedDay = null"
    />
  </Teleport>
</template>

<style scoped>
.full-screen-calendar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 4vh;
  box-sizing: border-box;
}

.month-picker-native {
  display: none;
}

.month-picker-desktop {
  display: block;
}

.month-picker-nav {
  display: flex;
  width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.05);
  transition: background-color 0.2s, border-color 0.2s;
}

.month-picker-nav:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.12);
}

@media (max-width: 767px), (hover: none), (pointer: coarse) {
  .month-picker-native {
    display: block;
  }

  .month-picker-desktop {
    display: none;
  }
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  grid-gap: 4px; /* iOS 12.1+ Fallback */
  gap: 4px;
  flex: 1;
  overflow: hidden;
}

.calendar-swipe-area {
  touch-action: none;
}

.month-slide-up-enter-active,
.month-slide-up-leave-active,
.month-slide-down-enter-active,
.month-slide-down-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.month-slide-up-enter-from,
.month-slide-down-leave-to {
  opacity: 0;
  transform: translateY(3vh);
}

.month-slide-up-leave-to,
.month-slide-down-enter-from {
  opacity: 0;
  transform: translateY(-3vh);
}

.calendar-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  position: relative;
  background-color: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0);
  border-radius: 12px;
}

.calendar-day.today {
  border: 1px solid rgba(255, 255, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.09);
}

.calendar-day.other-month {
  opacity: 0.2;
}

.calendar-header-day {
  text-align: center;
  padding: 3vh 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.5;
}
</style>
