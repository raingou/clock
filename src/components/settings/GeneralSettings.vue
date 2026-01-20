<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfigStore } from '../../stores/config'

const configStore = useConfigStore()
const { language } = storeToRefs(configStore)
const { t } = useI18n()

const languageDraft = ref(language.value)

function save() {
  language.value = languageDraft.value
}

function reset() {
  languageDraft.value = language.value
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
          :class="{ active: languageDraft === 'zh-CN' }"
          @click="languageDraft = 'zh-CN'"
        >
          {{ t('language.zhCN') }}
        </button>
        <button
          class="settings-tab-btn"
          :class="{ active: languageDraft === 'zh-TW' }"
          @click="languageDraft = 'zh-TW'"
        >
          {{ t('language.zhTW') }}
        </button>
        <button
          class="settings-tab-btn"
          :class="{ active: languageDraft === 'en-US' }"
          @click="languageDraft = 'en-US'"
        >
          {{ t('language.enUS') }}
        </button>
      </div>
    </section>
  </div>
</template>
