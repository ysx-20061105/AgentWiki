<script setup lang="ts">
import { computed } from 'vue'
import { data as articles } from '../articles.data'

interface YearGroup {
  year: string
  months: { month: string; articles: typeof articles }[]
}

const groups = computed<YearGroup[]>(() => {
  const map: Record<string, Record<string, typeof articles>> = {}

  articles.forEach(a => {
    if (!a.date) return
    const year = a.date.slice(0, 4)
    const month = a.date.slice(5, 7)
    if (!map[year]) map[year] = {}
    if (!map[year][month]) map[year][month] = []
    map[year][month].push(a)
  })

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  return Object.keys(map)
    .sort()
    .reverse()
    .map(year => ({
      year,
      months: Object.keys(map[year])
        .sort()
        .reverse()
        .map(month => ({
          month: monthNames[parseInt(month) - 1],
          articles: map[year][month]
        }))
    }))
})

function formatDay(date: string) {
  return parseInt(date.slice(8, 10)) + '日'
}
</script>

<template>
  <h1>归档</h1>
  <p style="color: var(--vp-c-text-2)">共 {{ articles.length }} 篇文章</p>

  <div class="archive-list">
    <div v-for="group in groups" :key="group.year" class="archive-year">
      <h2>{{ group.year }}</h2>
      <div v-for="monthGroup in group.months" :key="monthGroup.month">
        <h3>{{ monthGroup.month }}</h3>
        <div v-for="article in monthGroup.articles" :key="article.url" class="archive-item">
          <span class="date">{{ formatDay(article.date) }}</span>
          <a :href="article.url">{{ article.title }}</a>
        </div>
      </div>
    </div>
  </div>
</template>
