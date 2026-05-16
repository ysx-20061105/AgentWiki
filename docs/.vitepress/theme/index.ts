import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'
import Categories from './components/Categories.vue'
import Tags from './components/Tags.vue'
import Archive from './components/Archive.vue'
import ArticleList from './components/ArticleList.vue'
import HomeArticles from './components/HomeArticles.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Categories', Categories)
    app.component('Tags', Tags)
    app.component('Archive', Archive)
    app.component('ArticleList', ArticleList)
    app.component('HomeArticles', HomeArticles)
  }
} satisfies Theme
