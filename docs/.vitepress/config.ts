import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'AgentWiki',
  description: 'Agent 知识分享平台 - 探索 AI Agent 的原理、架构与实践',

  // GitHub Pages 部署时需要设置 base
  base: '/AgentWiki/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'AgentWiki',

    nav: [
      { text: '首页', link: '/' },
      { text: 'Agent', link: '/articles/agent-learning-roadmap' },
      { text: 'FastAPI', link: '/articles/fastapi-overview' },
      { text: 'Agent实践', link: '/articles/claude-code-context-management' }
    ],

    sidebar: {
      '/articles/': [
        {
          text: '🤖 Agent',
          collapsed: false,
          items: [
            { text: '学习路线', link: '/articles/agent-learning-roadmap' },
            { text: 'LLM 基础', link: '/articles/llm-basics' },
            { text: 'Prompt 工程', link: '/articles/prompt-engineering' },
            { text: '本地模型部署', link: '/articles/local-model-deployment' },
            { text: 'Agent 概述', link: '/articles/agent-overview' },
            { text: 'Agent 范式', link: '/articles/agent-paradigms' },
            { text: 'Agent Memory', link: '/articles/agent-memory' },
            { text: 'Context Engineering', link: '/articles/context-engineering' },
            { text: 'Function Calling', link: '/articles/function-calling' },
            { text: 'Tool 工具系统', link: '/articles/agent-tools' },
            { text: 'MCP 协议', link: '/articles/mcp-guide' },
            { text: 'Skills 技能', link: '/articles/skills' },
            { text: 'Agent Skills', link: '/articles/agent-skills' },
            { text: 'Multi-Agent', link: '/articles/multi-agent' },
            { text: 'SubAgent', link: '/articles/sub-agent' },
            { text: 'Agent Team', link: '/articles/agent-team' },
            { text: 'RAG 检索增强生成', link: '/articles/rag-guide' },
            { text: 'Harness Engineering', link: '/articles/harness-engineering' },
            { text: 'Agent Router', link: '/articles/agent-router' },
          ]
        },
        {
          text: '⚡ FastAPI',
          collapsed: true,
          items: [
            { text: '学习总览', link: '/articles/fastapi-overview' },
            { text: 'HTTP 方法与 CRUD', link: '/articles/fastapi-http-crud' },
            { text: '请求参数详解', link: '/articles/fastapi-request-params' },
            { text: 'Cookie / Session / Header', link: '/articles/fastapi-cookie-session-header' },
            { text: '响应处理', link: '/articles/fastapi-response-handling' },
            { text: '跨域请求 CORS', link: '/articles/fastapi-cors' },
            { text: 'SQLAlchemy 集成', link: '/articles/fastapi-sqlalchemy' },
            { text: 'Redis 集成', link: '/articles/fastapi-redis' },
            { text: '部署指南', link: '/articles/fastapi-deployment' },
            { text: 'Nacos 集成', link: '/articles/fastapi-nacos' },
          ]
        },
        {
          text: '🚀 Agent 实践',
          collapsed: false,
          items: [
            { text: 'Claude Code 上下文管理', link: '/articles/claude-code-context-management' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ysx-20061105' }
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
      pattern: 'https://github.com/ysx-20061105/AgentWiki/edit/main/docs/:path',
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
