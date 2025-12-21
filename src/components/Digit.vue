<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';

const props = defineProps<{
  value: number;
  trigger?: any; // 新增 trigger 属性，用于强制刷新倾斜度
}>();

// 内部状态，用于追踪当前的显示位置
const currentIndex = ref(props.value);
const isTransitioning = ref(true);

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const containerRotate = ref(`rotate(${(Math.random() * 12 - 6).toFixed(1)}deg)`);

// 监听 trigger 变化，每次时间跳动都强制刷新所有数字的角度
watch(() => props.trigger, () => {
  containerRotate.value = `rotate(${(Math.random() * 12 - 6).toFixed(1)}deg)`;
});

watch(() => props.value, (newVal, oldVal) => {
  // 当数值本身变化时，也会触发角度更新（作为双重保险）
  containerRotate.value = `rotate(${(Math.random() * 12 - 6).toFixed(1)}deg)`;

  if (oldVal === 9 && newVal === 0) {
    // 9 -> 0 特殊逻辑：滚动到第 11 个元素 (索引 10)
    isTransitioning.value = true;
    currentIndex.value = 10;
    
    // 动画结束后 (0.8s)，静默跳回索引 0
    setTimeout(() => {
      isTransitioning.value = false;
      currentIndex.value = 0;
    }, 800);
  } else {
    // 正常切换
    isTransitioning.value = true;
    currentIndex.value = newVal;
  }
});

onMounted(() => {
  currentIndex.value = props.value;
});
</script>

<template>
  <div class="digit-container" :style="{ transform: containerRotate }">
    <div 
      class="digit-wrapper" 
      :style="{ 
        transform: `translateY(-${currentIndex * 1}em)`,
        transition: isTransitioning ? 'transform 0.8s cubic-bezier(0, -0.6, 0.32, 1.6)' : 'none'
      }"
    >
      <div v-for="(digit, index) in digits" :key="index" class="digit-item">
        {{ digit }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.digit-container {
  position: relative;
  display: inline-block;
  height: 1em;
  width: 0.8em;
  overflow: hidden;
  opacity: 0.85;
  margin: 0 -0.12em;
  vertical-align: middle;
  /* 为倾斜（transform）增加平滑过渡动画 */
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.digit-wrapper {
  display: block;
  width: 100%;
}

.digit-item {
  display: block;
  height: 1em;
  line-height: 1em;
  text-align: center;
}
</style>
