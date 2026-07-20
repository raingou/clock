<script setup lang="ts">
import type { Anniversary } from '../../types'
import { Download, Plus, Trash2, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfigStore } from '../../stores/config'

const configStore = useConfigStore()
const { calendarConfig } = storeToRefs(configStore)
const { t } = useI18n()

const calendarDraft = ref({
  ...calendarConfig.value,
  holidayCountries: [...(calendarConfig.value.holidayCountries || ['CN'])],
  lunarAnniversaries: (calendarConfig.value.lunarAnniversaries || []).map(item => ({ ...item, calendarType: item.calendarType || 'lunar' as const })),
})
const importInput = ref<HTMLInputElement | null>(null)

const lunarMonths = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
const solarMonths = Array.from({ length: 12 }, (_, index) => `${index + 1}月`)
const lunarDays = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']
const solarDays = Array.from({ length: 31 }, (_, index) => `${index + 1}日`)
const holidayCountries = [
  { code: 'CN' as const, labelKey: 'calendarSettings.china' },
  { code: 'VN' as const, labelKey: 'calendarSettings.vietnam' },
  { code: 'KH' as const, labelKey: 'calendarSettings.cambodia' },
]

function toggleHolidayCountry(code: 'CN' | 'VN' | 'KH') {
  const countries = calendarDraft.value.holidayCountries
  calendarDraft.value.holidayCountries = countries.includes(code)
    ? countries.filter(item => item !== code)
    : [...countries, code]
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function addAnniversary() {
  calendarDraft.value.lunarAnniversaries.push({ id: newId(), name: '', calendarType: 'lunar', month: 1, day: 1, leapMonth: 'normal' })
}

function removeAnniversary(id: string) {
  calendarDraft.value.lunarAnniversaries = calendarDraft.value.lunarAnniversaries.filter(item => item.id !== id)
}

function isValidAnniversary(item: unknown): item is Anniversary {
  if (!item || typeof item !== 'object') return false
  const value = item as Partial<Anniversary>
  return typeof value.name === 'string'
    && value.name.trim().length > 0
    && Number.isInteger(value.month) && value.month! >= 1 && value.month! <= 12
    && Number.isInteger(value.day) && value.day! >= 1 && value.day! <= (value.calendarType === 'solar' ? 31 : 30)
    && (!value.calendarType || ['lunar', 'solar'].includes(value.calendarType))
    && ['normal', 'leap', 'both'].includes(value.leapMonth || '')
}

function exportJson() {
  const data = JSON.stringify({ version: 2, anniversaries: calendarDraft.value.lunarAnniversaries }, null, 2)
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `anniversaries-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function importJson(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text())
    const items = Array.isArray(parsed) ? parsed : (parsed?.anniversaries || parsed?.lunarAnniversaries)
    if (!Array.isArray(items) || !items.every(isValidAnniversary)) throw new Error('invalid')
    calendarDraft.value.lunarAnniversaries = items.map(item => ({
      ...item,
      id: item.id || newId(),
      name: item.name.trim(),
      calendarType: item.calendarType || 'lunar',
    }))
    window.alert(t('calendarSettings.importSuccess', { count: items.length }))
  }
  catch {
    window.alert(t('calendarSettings.importInvalid'))
  }
  finally {
    input.value = ''
  }
}

function save() {
  calendarConfig.value = { ...calendarDraft.value }
}

function reset() {
  calendarDraft.value = {
    ...calendarConfig.value,
    holidayCountries: [...(calendarConfig.value.holidayCountries || ['CN'])],
    lunarAnniversaries: (calendarConfig.value.lunarAnniversaries || []).map(item => ({ ...item, calendarType: item.calendarType || 'lunar' as const })),
  }
}

defineExpose({ save, reset })
</script>

<template>
  <div class="space-y-10 animate-fade-in">
    <section>
      <h4 class="text-white/60 mb-4 uppercase tracking-widest text-sm font-medium">
        {{ t('calendarSettings.weekStart') }}
      </h4>
      <div class="grid grid-cols-2 space-x-4">
        <button
          class="settings-tab-btn"
          :class="{ active: calendarDraft.weekStartDay === 1 }"
          @click="calendarDraft.weekStartDay = 1"
        >
          {{ t('calendarSettings.monday') }}
        </button>
        <button
          class="settings-tab-btn"
          :class="{ active: calendarDraft.weekStartDay === 0 }"
          @click="calendarDraft.weekStartDay = 0"
        >
          {{ t('calendarSettings.sunday') }}
        </button>
      </div>
    </section>

    <section>
      <h4 class="text-white/60 mb-4 uppercase tracking-widest text-sm font-medium">
        {{ t('calendarSettings.display') }}
      </h4>
      <div
        class="settings-toggle-card"
        :class="{ active: calendarDraft.showHolidays }"
        @click="calendarDraft.showHolidays = !calendarDraft.showHolidays"
      >
        <span class="font-medium">{{ t('calendarSettings.showHolidays') }}</span>
        <div class="toggle-switch">
          <div class="toggle-dot" />
        </div>
      </div>
      <div v-if="calendarDraft.showHolidays" class="grid grid-cols-3 gap-3 mt-4">
        <button
          v-for="country in holidayCountries"
          :key="country.code"
          type="button"
          class="settings-tab-btn"
          :class="{ active: calendarDraft.holidayCountries.includes(country.code) }"
          @click="toggleHolidayCountry(country.code)"
        >
          {{ t(country.labelKey) }}
        </button>
      </div>
    </section>

    <section>
      <div class="flex items-center justify-between gap-3 mb-4">
        <h4 class="text-white/60 uppercase tracking-widest text-sm font-medium">
          {{ t('calendarSettings.anniversaries') }}
        </h4>
        <div class="flex gap-2">
          <button class="settings-secondary-btn" type="button" @click="importInput?.click()">
            <Upload class="w-4 h-4" /> {{ t('calendarSettings.importJson') }}
          </button>
          <button class="settings-secondary-btn" type="button" @click="exportJson">
            <Download class="w-4 h-4" /> {{ t('calendarSettings.exportJson') }}
          </button>
          <input ref="importInput" type="file" accept="application/json,.json" class="hidden" @change="importJson">
        </div>
      </div>

      <div class="space-y-3">
        <div v-for="item in calendarDraft.lunarAnniversaries" :key="item.id" class="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
          <input v-model="item.name" class="settings-input min-w-0" :placeholder="t('calendarSettings.anniversaryName')">
          <select v-model="item.calendarType" class="settings-input w-24">
            <option value="lunar">{{ t('calendarSettings.lunar') }}</option>
            <option value="solar">{{ t('calendarSettings.solar') }}</option>
          </select>
          <select v-model.number="item.month" class="settings-input w-24">
            <option v-for="(label, index) in item.calendarType === 'solar' ? solarMonths : lunarMonths" :key="label" :value="index + 1">{{ label }}</option>
          </select>
          <select v-model.number="item.day" class="settings-input w-24">
            <option v-for="(label, index) in item.calendarType === 'solar' ? solarDays : lunarDays" :key="label" :value="index + 1">{{ label }}</option>
          </select>
          <button type="button" class="p-3 text-red-300 hover:bg-white/10 rounded-xl" @click="removeAnniversary(item.id)">
            <Trash2 class="w-5 h-5" />
          </button>
          <select v-if="item.calendarType !== 'solar'" v-model="item.leapMonth" class="settings-input col-span-5">
            <option value="normal">{{ t('calendarSettings.normalMonth') }}</option>
            <option value="leap">{{ t('calendarSettings.leapMonth') }}</option>
            <option value="both">{{ t('calendarSettings.bothMonths') }}</option>
          </select>
        </div>
        <button type="button" class="settings-secondary-btn" @click="addAnniversary">
          <Plus class="w-4 h-4" /> {{ t('calendarSettings.addAnniversary') }}
        </button>
      </div>
    </section>
  </div>
</template>
