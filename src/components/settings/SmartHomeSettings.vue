<script setup lang="ts">
import type { HAConfig } from '../../types'
import { ChevronDown, ChevronUp, Code, List, Minus, Plus, PlusCircle } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { onMounted, ref, watch } from 'vue'
import { useConfigStore } from '../../stores/config'
import { useHAStore } from '../../stores/ha'
import TestHAConnection from './TestHAConnection.vue'

const configStore = useConfigStore()
const haStore = useHAStore()
const { haConfig } = storeToRefs(configStore)
const { entitiesStates } = storeToRefs(haStore)

const smartConfig = ref<HAConfig>(JSON.parse(JSON.stringify(haConfig.value)))
const isJsonMode = ref(false)
const jsonInput = ref('')
const entityNameMap = ref<Record<string, string>>({})

function refreshEntityNameMap() {
  const nextMap: Record<string, string> = {}
  const states = entitiesStates.value
  if (states) {
    Object.keys(states).forEach((entityId) => {
      const name = states[entityId]?.attributes?.friendly_name
      if (name) nextMap[entityId] = name
    })
  }
  entityNameMap.value = nextMap
}

watch(isJsonMode, (newVal) => {
  if (newVal) {
    jsonInput.value = JSON.stringify({
      url: smartConfig.value.url,
      token: smartConfig.value.token,
      entities: smartConfig.value.entities,
    }, null, 2)
  }
  else {
    try {
      const parsed = JSON.parse(jsonInput.value)
      if (parsed && typeof parsed === 'object') {
        if (parsed.url !== undefined) smartConfig.value.url = parsed.url
        if (parsed.token !== undefined) smartConfig.value.token = parsed.token
        if (Array.isArray(parsed.entities)) smartConfig.value.entities = parsed.entities
      }
    }
    catch (e) {
      alert('JSON 格式错误，请检查后再切换模式')
      setTimeout(
        () => { isJsonMode.value = true },
        0,
      )
    }
  }
})

function addEntity(index?: number) {
  if (index !== undefined) {
    smartConfig.value.entities.splice(index, 0, { id: '', name: '' })
  }
  else {
    smartConfig.value.entities.push({ id: '', name: '' })
  }
}

function removeEntity(index: number) {
  smartConfig.value.entities.splice(index, 1)
}

function moveEntity(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex >= 0 && newIndex < smartConfig.value.entities.length) {
    const temp = smartConfig.value.entities[index]
    smartConfig.value.entities[index] = smartConfig.value.entities[newIndex]
    smartConfig.value.entities[newIndex] = temp
  }
}

function save() {
  if (isJsonMode.value) {
    try {
      const parsed = JSON.parse(jsonInput.value)
      smartConfig.value.url = parsed.url || ''
      smartConfig.value.token = parsed.token || ''
      smartConfig.value.entities = Array.isArray(parsed.entities) ? parsed.entities : []
    }
    catch (e) {
      alert('JSON 格式错误，保存失败')
      return
    }
  }
  haConfig.value = JSON.parse(JSON.stringify(smartConfig.value))
}

function reset() {
  smartConfig.value = JSON.parse(JSON.stringify(haConfig.value))
  refreshEntityNameMap()
}

defineExpose({ save, reset })

onMounted(() => {
  refreshEntityNameMap()
})
</script>

<template>
  <div class="space-y-10 animate-fade-in">
    <section class="flex flex-col gap-4">
      <div class="flex items-center justify-between mb-6">
        <h4 class="text-white/50 uppercase tracking-widest text-sm font-medium">
          基础配置
        </h4>
        <button
          class="text-[10px] flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 transition-all"
          @click="isJsonMode = !isJsonMode"
        >
          <component :is="isJsonMode ? List : Code" class="w-3.5 h-3.5" />
          {{ isJsonMode ? '列表模式' : 'JSON 模式' }}
        </button>
      </div>

      <div v-if="!isJsonMode" class="space-y-6">
        <div class="space-y-2">
          <label class="block text-sm opacity-50 mb-2 uppercase tracking-widest">HA 地址</label>
          <input
            v-model="smartConfig.url"
            type="text"
            placeholder="http://192.168.1.xxx:8123"
            class="settings-input"
          >
        </div>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-sm opacity-50 mb-2 uppercase tracking-widest">长期访问令牌</label>
            <TestHAConnection :url="smartConfig.url" :token="smartConfig.token" />
          </div>

          <input
            v-model="smartConfig.token"
            type="password"
            placeholder="输入令牌"
            class="settings-input"
          >
        </div>

        <div class="space-y-4 pt-4">
          <div class="flex items-center justify-between">
            <h4 class="text-white/50 uppercase tracking-widest text-sm font-medium">
              设备管理
            </h4>
            <span class="text-sm text-white/20 font-mono">{{ smartConfig.entities.length }} 个实体</span>
          </div>
          <div class="space-y-4">
            <div v-for="(entity, index) in smartConfig.entities" :key="entity.id || index" class="relative flex gap-2 items-stretch group">
              <div class="flex flex-col justify-between opacity-60 flex-shrink-0 border border-white/10 rounded-2xl px-1 py-1.5 bg-white/5">
                <button class="bg-white/10 rounded-full p-1 text-white/80 hover:text-white hover:bg-white/20 transition-all" @click="moveEntity(index, -1)">
                  <ChevronUp class="w-4 h-4" />
                </button>
                <button class="bg-white/10 rounded-full p-1 text-white/80 hover:text-white hover:bg-white/20 transition-all" @click="moveEntity(index, 1)">
                  <ChevronDown class="w-4 h-4" />
                </button>
              </div>
              <div class="flex-1">
                <input
                  v-model="entity.name"
                  type="text"
                  :placeholder="entityNameMap[entity.id] || '备注名（可选）'"
                  class="settings-input py-2.5 !rounded-b-none text-sm"
                >
                <input
                  v-model="entity.id"
                  type="text"
                  placeholder="实体 ID"
                  class="settings-input py-2.5 !rounded-t-none text-sm"
                >
              </div>
              <div class="flex flex-col justify-between transition-opacity flex-shrink-0 border border-white/5 rounded-2xl px-1 py-1.5 bg-white/5">
                <button
                  class="bg-white/10 rounded-full p-1 text-white/50 transition-all hover:text-white hover:bg-white/20"
                  @click="addEntity(index)"
                >
                  <Plus class="w-4 h-4" />
                </button>
                <button
                  class="bg-white/10 rounded-full p-1 text-white/50 transition-all hover:text-white hover:bg-white/20"
                  @click="removeEntity(index)"
                >
                  <Minus class="w-4 h-4" />
                </button>
              </div>
            </div>
            <button class="settings-secondary-btn w-full justify-center border-dashed border-white/10 py-3 !mt-6" @click="addEntity()">
              <span class="flex items-center gap-2">
                <PlusCircle class="w-4 h-4 mr-2" /> 添加设备
              </span>
            </button>
          </div>
        </div>
      </div>

      <textarea
        v-else
        v-model="jsonInput"
        :rows="25"
        class="settings-input font-mono text-xs leading-relaxed resize-none p-5"
        placeholder="{ &quot;url&quot;: &quot;...&quot;, &quot;token&quot;: &quot;...&quot;, &quot;entities&quot;: [] }"
      />
    </section>
  </div>
</template>

<style scoped>

</style>
