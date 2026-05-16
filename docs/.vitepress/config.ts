import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'AgentWiki',
  description: 'Agent 知识分享平台 - 探索 AI Agent 的原理、架构与实践',

  // GitHub Pages 部署时需要设置 base
  // base: '/AgentWiki/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'AgentWiki',

    nav: [
      { text: '首页', link: '/' },
      { text: '文章', link: '/articles/' },
      { text: '分类', link: '/categories' },
      { text: '标签', link: '/tags' },
      { text: '归档', link: '/archive' },
      { text: '关于', link: '/about' }
    ],

    sidebar: {
      '/articles/': [
        {
          text: '基础知识',
          items: [
            { text: 'AI Agent 基础概念', link: '/articles/agent-basics' }
          ]
        },
        {
          text: '开发工具',
          items: [
            { text: 'LangChain 入门指南', link: '/articles/langchain-guide' }
          ]
        },
        {
          text: '架构设计',
          items: [
            { text: '多 Agent 系统设计模式', link: '/articles/multi-agent' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/' }
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文章', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '未找到相关结果',
            resetButtonTitle: '清除搜索条件',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },

    editLink: {
      pattern: 'https://github.com/YOUR_USERNAME/AgentWiki/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    footer: {
      message: '基于 MIT 许可发布',
      copyright: 'Copyright © 2026 AgentWiki'
    },

    outline: {
      label: '页面导航',
      level: [2, 3]
    },

    lastUpdated: {
      text: '最后更新于'
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    returnToTopLabel: '回到顶部',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式'
  }
})
