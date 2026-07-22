<script setup lang="ts">
import { Download, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfigStore } from '../../stores/config'
import { useWeatherStore } from '../../stores/weather'

const configStore = useConfigStore()
const weatherStore = useWeatherStore()
const { language, layoutConfig } = storeToRefs(configStore)
const { t } = useI18n()

const layoutDraft = ref({ ...layoutConfig.value })
const importInput = ref<HTMLInputElement | null>(null)

const weatherConfigKeys = [
  'locationMode', 'customLat', 'customLon', 'customCity', 'refreshInterval',
  'showRainEffect', 'showThunderEffect', 'showSnowEffect',
] as const

function exportSettings() {
  if (!window.confirm(t('generalSettings.exportSecurityWarning'))) return
  const weather = Object.fromEntries(weatherConfigKeys.map(key => [key, weatherStore[key]]))
  const backup = {
    schema: 'clock-dashboard-settings',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      language: configStore.language,
      layoutConfig: configStore.layoutConfig,
      clockConfig: configStore.clockConfig,
      calendarConfig: configStore.calendarConfig,
      haLayout: configStore.haLayout,
      haConfig: configStore.haConfig,
      weather,
    },
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `clock-settings-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

async function importSettings(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const backup = JSON.parse(await file.text())
    if (backup?.schema !== 'clock-dashboard-settings' || backup?.version !== 1 || !isRecord(backup.settings)) throw new Error('invalid backup')
    if (!window.confirm(t('generalSettings.importConfirm'))) return

    const settings = backup.settings
    if (['zh-CN', 'zh-TW', 'en-US'].includes(settings.language)) configStore.language = settings.language
    if (isRecord(settings.layoutConfig)) configStore.layoutConfig = { ...configStore.layoutConfig, ...settings.layoutConfig }
    if (isRecord(settings.clockConfig)) configStore.clockConfig = { ...configStore.clockConfig, ...settings.clockConfig }
    if (isRecord(settings.calendarConfig)) {
      configStore.calendarConfig = {
        ...configStore.calendarConfig,
        ...settings.calendarConfig,
        holidayCountries: Array.isArray(settings.calendarConfig.holidayCountries) ? settings.calendarConfig.holidayCountries : configStore.calendarConfig.holidayCountries,
        lunarAnniversaries: Array.isArray(settings.calendarConfig.lunarAnniversaries) ? settings.calendarConfig.lunarAnniversaries : configStore.calendarConfig.lunarAnniversaries,
      }
    }
    if (isRecord(settings.haLayout)) configStore.haLayout = { ...configStore.haLayout, ...settings.haLayout }
    if (isRecord(settings.haConfig) && typeof settings.haConfig.url === 'string' && typeof settings.haConfig.token === 'string' && Array.isArray(settings.haConfig.entities)) {
      configStore.haConfig = {
        url: settings.haConfig.url,
        token: settings.haConfig.token,
        entities: settings.haConfig.entities.filter((item: unknown) => isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string'),
      }
    }
    if (isRecord(settings.weather)) {
      const weatherPatch = Object.fromEntries(weatherConfigKeys.filter(key => settings.weather[key] !== undefined).map(key => [key, settings.weather[key]]))
      weatherStore.$patch(weatherPatch)
    }
    layoutDraft.value = { ...configStore.layoutConfig }
    await weatherStore.updateWeather()
    window.alert(t('generalSettings.importSuccess'))
  }
  catch {
    window.alert(t('generalSettings.importInvalid'))
  }
  finally {
    input.value = ''
  }
}

function save() {
  layoutConfig.value = { ...layoutDraft.value }
}

function reset() {
  layoutDraft.value = { ...layoutConfig.value }
}

defineExpose({ save, reset })
</script>

<template>
  <div class="space-y-10 animate-fade-in">
    <section>
      <h4 class="text-white/60 mb-4 uppercase tracking-widest text-sm font-medium">
        {{ t('language.label') }} (beta)
      </h4>
      <div class="grid grid-cols-3 space-x-3">
        <button
          class="settings-tab-btn"
          :class="{ active: language === 'zh-CN' }"
          @click="language = 'zh-CN'"
        >
          {{ t('language.zhCN') }}
        </button>
        <button
          class="settings-tab-btn"
          :class="{ active: language === 'zh-TW' }"
          @click="language = 'zh-TW'"
        >
          {{ t('language.zhTW') }}
        </button>
        <button
          class="settings-tab-btn"
          :class="{ active: language === 'en-US' }"
          @click="language = 'en-US'"
        >
          {{ t('language.enUS') }}
        </button>
      </div>
    </section>

    <section class="space-y-4">
      <h4 class="text-white/60 mb-4 uppercase tracking-widest text-sm font-medium">
        {{ t('generalSettings.layout') }}
      </h4>
      <div
        class="settings-toggle-card"
        :class="{ active: layoutDraft.clockOnlyMode }"
        @click="layoutDraft.clockOnlyMode = !layoutDraft.clockOnlyMode"
      >
        <span class="font-medium">{{ t('generalSettings.clockOnlyMode') }}</span>
        <div class="toggle-switch">
          <div class="toggle-dot" />
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <h4 class="text-white/60 mb-4 uppercase tracking-widest text-sm font-medium">
        {{ t('generalSettings.backup') }}
      </h4>
      <p class="text-xs text-white/40 leading-relaxed">
        {{ t('generalSettings.backupDescription') }}
      </p>
      <div class="grid grid-cols-2 gap-3">
        <button class="settings-secondary-btn justify-center" type="button" @click="importInput?.click()">
          <Upload class="w-4 h-4" /> {{ t('generalSettings.importAll') }}
        </button>
        <button class="settings-secondary-btn justify-center" type="button" @click="exportSettings">
          <Download class="w-4 h-4" /> {{ t('generalSettings.exportAll') }}
        </button>
        <input ref="importInput" type="file" accept="application/json,.json" class="hidden" @change="importSettings">
      </div>
      <p class="text-xs text-amber-300/70 leading-relaxed">
        {{ t('generalSettings.tokenWarning') }}
      </p>
    </section>
  </div>
</template>
