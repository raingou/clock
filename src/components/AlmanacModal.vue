<script setup lang="ts">
import type { Anniversary, LunarInfo } from '../types'
import { X } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  show: boolean
  date: Date
  lunar: LunarInfo
  anniversaries: Anniversary[]
  holidays: Array<{ code: string, name: string }>
}>()

defineEmits(['close'])

const { locale, t } = useI18n()

const weekdayLabel = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, { weekday: 'long' })
  return formatter.format(props.date)
})

const dateLabel = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long', day: 'numeric' })
  return formatter.format(props.date)
})

const showLunar = computed(() => locale.value !== 'en-US')
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    @touchstart.stop
    @touchend.stop
    @mousedown.stop
    @mouseup.stop
  >
    <!-- 背景遮罩 -->
    <div class="absolute inset-0 bg-black/80" @click="$emit('close')" />

    <!-- 弹窗内容 -->
    <div class="relative w-full max-w-xl bg-neutral-900 border border-white/10 rounded-3xl overflow-hidden py-6">
      <button
        class="p-3 hover:bg-white/10 rounded-full transition-colors absolute top-2 right-2"
        @click="$emit('close')"
      >
        <X class="w-6 h-6" />
      </button>

      <div class="almanac-scroll space-y-4 max-h-[80vh] overflow-y-auto px-6">
        <!-- 头部日期 -->
        <div class="text-2xl">
          {{ dateLabel }} · {{ weekdayLabel }}
        </div>

        <!-- 节日节气、法定假日与自定义纪念日 -->
        <div v-if="lunar.festival || holidays.length || anniversaries.length" class="border border-white/10 rounded-2xl overflow-hidden">
          <div v-if="lunar.festival" class="p-4" :class="{ 'border-b border-white/10': holidays.length || anniversaries.length }">
            <div class="text-sm text-white/50 mb-2 uppercase tracking-widest">
              {{ t('calendar.detailFestivals') }}
            </div>
            <div class="flex flex-wrap gap-2">
              <span class="px-3 py-1.5 rounded-full bg-blue-400/10 text-blue-300">
                {{ lunar.festival }}
              </span>
            </div>
          </div>
          <div v-if="holidays.length" class="p-4" :class="{ 'border-b border-white/10': anniversaries.length }">
            <div class="text-sm text-white/50 mb-2 uppercase tracking-widest">
              {{ t('calendar.detailHolidays') }}
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="item in holidays" :key="`${item.code}-${item.name}`" class="px-3 py-1.5 rounded-full bg-red-400/10 text-red-300">
                {{ item.code }} · {{ item.name }}
              </span>
            </div>
          </div>
          <div v-if="anniversaries.length" class="p-4">
            <div class="text-sm text-white/50 mb-2 uppercase tracking-widest">
              {{ t('calendar.detailAnniversaries') }}
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="item in anniversaries" :key="item.id" class="px-3 py-1.5 rounded-full bg-pink-400/10 text-pink-300">
                {{ item.name }} · {{ t(item.calendarType === 'solar' ? 'calendarSettings.solar' : 'calendarSettings.lunar') }}
              </span>
            </div>
          </div>
        </div>

        <template v-if="showLunar">
          <!-- 农历信息 -->
          <div class="text-xl">
            {{ lunar.year }}({{ lunar.yearShengxiao }})年 {{ lunar.month }}({{ lunar.monthGanzhi }})月 {{ lunar.date }}({{ lunar.dayGanzhi }})日
          </div>

          <!-- 宜忌内容 -->
          <div class="grid grid-cols-2 border border-white/10 rounded-2xl">
            <div class="border-r border-white/10">
              <div class="text-center text-emerald-400 font-bold text-lg border-b border-white/10 bg-white/5 p-2 rounded-tl-2xl">
                {{ t('almanac.yi') }}
              </div>
              <div class="flex-1 flex flex-wrap p-2">
                <span v-for="item in lunar.yi" :key="item" class="text-md text-emerald-50/90 m-1">{{ item }}</span>
              </div>
            </div>

            <div class="border-l border-white/10">
              <div class="text-center text-red-400 font-bold text-lg border-b border-white/10 bg-white/5 p-2 rounded-tr-2xl">
                {{ t('almanac.ji') }}
              </div>
              <div class="flex-1 flex flex-wrap p-2">
                <span v-for="item in lunar.ji" :key="item" class="text-md text-red-50/90 m-1">{{ item }}</span>
              </div>
            </div>
          </div>

          <!-- 时辰吉凶 -->
          <div v-if="lunar.hours" class="border border-white/10 rounded-2xl">
            <div class="text-center text-white/80 text-lg border-b border-white/10 bg-white/5 rounded-t-2xl p-2">
              {{ t('almanac.hourlyLuck') }}
            </div>
            <div class="grid grid-cols-12 p-2 py-4">
              <div
                v-for="h in lunar.hours"
                :key="h.hour"
                class="flex items-center justify-center text-md text-emerald-50/90 tracking-widest"
                style="writing-mode: vertical-rl;"
              >
                <span>
                  {{ h.ganzhi }}
                </span>
                <span
                  class="font-bold mt-1"
                  :class="h.luck === '吉' ? 'text-emerald-400' : 'text-red-400'"
                >
                  {{ h.luck }}
                </span>
              </div>
            </div>
          </div>

          <!-- 彭祖百忌 -->
          <div v-if="lunar.pengzu" class="border border-white/10 rounded-2xl">
            <div class="text-center text-white/80 text-lg border-b border-white/10 bg-white/5 rounded-t-2xl p-2">
              {{ t('almanac.pengzu') }}
            </div>
            <div class="flex items-center justify-center text-center p-2 py-4 text-md text-emerald-50/90 tracking-widest space-x-3">
              <span v-for="item in lunar.pengzu" :key="item">
                {{ item }}
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.almanac-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.almanac-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>
