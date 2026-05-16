# AgentWiki

Agent 知识分享平台 - 基于 GitHub Pages 的静态网站

## 特性

- 纯前端方案，无需构建工具，上传 Markdown 即可更新
- 分类、标签、搜索、归档、RSS 全功能支持
- 暗色/亮色主题切换
- 响应式设计，移动端友好
- GitHub Action 自动更新文章索引

## 快速开始

### 1. Fork 或 Clone 本仓库

```bash
git clone https://github.com/YOUR_USERNAME/AgentWiki.git
cd AgentWiki
```

### 2. 添加文章

在 `articles/` 目录创建 Markdown 文件：

```markdown
---
title: 文章标题
date: 2026-05-16
category: 分类名称
tags: [标签1, 标签2]
summary: 一句话摘要
---

正文内容...
```

### 3. 更新索引

**方式一（自动）**: 推送到 main 分支后，GitHub Action 会自动更新 `index.json` 和 `feed.xml`

**方式二（手动）**: 本地运行

```bash
node .github/scripts/generate-index.js
```

### 4. 部署

1. 进入仓库 Settings > Pages
2. Source 选择 `Deploy from a branch`
3. Branch 选择 `main`，目录选择 `/ (root)`
4. 保存后等待部署完成

访问 `https://YOUR_USERNAME.github.io/AgentWiki/` 即可

## 目录结构

```
├── index.html              # 主页面
├── css/style.css           # 样式
├── js/
│   ├── app.js              # 路由和主逻辑
│   ├── md-loader.js        # Markdown 解析
│   ├── search.js           # 搜索功能
│   └── sidebar.js          # 侧边栏
├── articles/               # 文章目录
├── index.json              # 文章索引（自动生成）
├── feed.xml                # RSS 订阅（自动生成）
└── 404.html                # 自定义 404
```

## 路由说明

| 路由 | 说明 |
|------|------|
| `#/` | 首页 |
| `#/article/{slug}` | 文章详情 |
| `#/categories` | 分类列表 |
| `#/category/{name}` | 分类文章 |
| `#/tags` | 标签云 |
| `#/tag/{name}` | 标签文章 |
| `#/archive` | 归档 |
| `#/about` | 关于 |
| `#/search?q=xxx` | 搜索 |

## 许可

MIT License
