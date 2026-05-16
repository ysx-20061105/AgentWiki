<script setup lang="ts">
import { computed } from 'vue'
import { data as articles } from '../articles.data'
import ArticleList from './ArticleList.vue'

const tags = computed(() => {
  const map: Record<string, number> = {}
  articles.forEach(a => {
    (a.tags || []).forEach((t: string) => {
      map[t] = (map[t] || 0) + 1
    })
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1])
})

const selected = computed(() => {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash
  if (hash.startsWith('#')) return decodeURIComponent(hash.slice(1))
  return ''
})
</script>

<template>
  <div v-if="!selected">
    <h1>标签</h1>
    <p style="color: var(--vp-c-text-2)">共 {{ tags.length }} 个标签</p>
    <div class="tag-cloud">
      <a
        v-for="[name, count] in tags"
        :key="name"
        :href="`/tags#${encodeURIComponent(name)}`"
        class="tag"
      >
        {{ name }} <span class="num">{{ count }}</span>
      </a>
    </div>
  </div>
  <div v-else>
    <p style="margin-bottom: 12px;">
      <a href="/tags" style="font-size: 0.9rem;">← 返回标签</a>
    </p>
    <h1># {{ selected }}</h1>
    <ArticleList :tag="selected" />
  </div>
</template>
