<script setup lang="ts">
import { ref, computed } from 'vue'
import { data as articles } from '../articles.data'

const categories = computed(() => {
  const cats = new Set(articles.map(a => a.category))
  return ['全部', ...cats]
})

const activeTab = ref('全部')

const filtered = computed(() => {
  if (activeTab.value === '全部') return articles
  return articles.filter(a => a.category === activeTab.value)
})

function formatDate(date: string) {
  if (!date) return ''
  const [y, m, d] = date.split('-')
  return `${y}.${m}.${d}`
}
</script>

<template>
  <div class="home-articles">
    <div class="tabs">
      <button
        v-for="cat in categories"
        :key="cat"
        :class="['tab', { active: activeTab === cat }]"
        @click="activeTab = cat"
      >
        {{ cat }}
      </button>
    </div>
    <div class="list">
      <a
        v-for="article in filtered"
        :key="article.url"
        :href="article.url"
        class="item"
      >
        <div class="item-info">
          <div class="item-title">{{ article.title }}</div>
          <div class="item-meta">
            <span class="item-date">{{ formatDate(article.date) }}</span>
            <span class="item-cat">{{ article.category }}</span>
          </div>
        </div>
        <div class="item-summary" v-if="article.summary">{{ article.summary }}</div>
      </a>
    </div>
  </div>
</template>

<style scoped>
.home-articles {
  max-width: 720px;
  margin: 40px auto 0;
  padding: 0 24px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.tab {
  padding: 6px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.tab.active {
  background: var(--vp-c-brand-1);
  color: #fff;
  border-color: var(--vp-c-brand-1);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.item {
  display: block;
  padding: 20px 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.25s;
}

.item:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.item-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.item-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  transition: color 0.2s;
}

.item:hover .item-title {
  color: var(--vp-c-brand-1);
}

.item-meta {
  display: flex;
  gap: 10px;
  font-size: 0.82rem;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}

.item-cat {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 0.78rem;
}

.item-summary {
  margin-top: 8px;
  font-size: 0.88rem;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}
</style>
