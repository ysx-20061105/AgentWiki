<script setup lang="ts">
import { computed } from 'vue'
import { data as articles } from '../articles.data'
import ArticleList from './ArticleList.vue'

const props = defineProps<{ selected?: string }>()

const categories = computed(() => {
  const map: Record<string, number> = {}
  articles.forEach(a => {
    const cat = a.category || '未分类'
    map[cat] = (map[cat] || 0) + 1
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1])
})

// 从 URL hash 获取选中的分类
const selected = computed(() => {
  if (typeof window === 'undefined') return props.selected || ''
  const hash = window.location.hash
  if (hash.startsWith('#')) return decodeURIComponent(hash.slice(1))
  return props.selected || ''
})
</script>

<template>
  <div v-if="!selected">
    <h1>分类</h1>
    <p style="color: var(--vp-c-text-2)">共 {{ categories.length }} 个分类</p>
    <div class="category-grid">
      <a
        v-for="[name, count] in categories"
        :key="name"
        :href="`/categories#${encodeURIComponent(name)}`"
        class="category-item"
      >
        <div class="name">{{ name }}</div>
        <div class="count">{{ count }} 篇文章</div>
      </a>
    </div>
  </div>
  <div v-else>
    <p style="margin-bottom: 12px;">
      <a href="/categories" style="font-size: 0.9rem;">← 返回分类</a>
    </p>
    <h1>{{ selected }}</h1>
    <ArticleList :category="selected" />
  </div>
</template>
