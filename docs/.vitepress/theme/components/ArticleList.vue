<script setup lang="ts">
import { data as articles } from '../articles.data'

defineProps<{
  category?: string
  tag?: string
  limit?: number
}>()

function formatDate(date: string) {
  if (!date) return ''
  const [y, m, d] = date.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function filterArticles(articles: any[], category?: string, tag?: string) {
  let result = [...articles]
  if (category) result = result.filter(a => a.category === category)
  if (tag) result = result.filter(a => a.tags?.includes(tag))
  return result
}
</script>

<template>
  <div>
    <div
      v-for="article in filterArticles(articles, category, tag).slice(0, limit)"
      :key="article.url"
      class="article-card"
    >
      <h3 class="title">
        <a :href="article.url">{{ article.title }}</a>
      </h3>
      <div class="meta">
        <span>{{ formatDate(article.date) }}</span>
        <a :href="`/categories#${article.category}`" class="badge badge-category">
          {{ article.category }}
        </a>
        <span v-for="tag in article.tags" :key="tag">
          <a :href="`/tags#${tag}`" class="badge badge-tag">{{ tag }}</a>
        </span>
      </div>
      <p class="summary" v-if="article.summary">{{ article.summary }}</p>
    </div>
    <p v-if="filterArticles(articles, category, tag).length === 0" style="color: var(--vp-c-text-3); text-align: center; padding: 40px 0;">
      暂无文章
    </p>
  </div>
</template>
