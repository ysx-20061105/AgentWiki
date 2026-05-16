import { createContentLoader } from 'vitepress'

export interface Article {
  title: string
  url: string
  date: string
  category: string
  tags: string[]
  summary: string
}

declare const data: Article[]
export { data }

export default createContentLoader('articles/*.md', {
  excerpt: false,
  transform(raw): Article[] {
    return raw
      .map(({ url, frontmatter }) => ({
        title: frontmatter.title || '',
        url,
        date: String(frontmatter.date || '').slice(0, 10),
        category: frontmatter.category || '未分类',
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        summary: frontmatter.summary || ''
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }
})
