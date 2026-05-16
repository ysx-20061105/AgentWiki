# AgentWiki

Agent 知识分享平台 - 基于 VitePress 构建

## 快速开始

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 添加文章

在 `docs/articles/` 目录创建 Markdown 文件：

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

添加新文章后需要更新侧边栏配置：编辑 `docs/.vitepress/config.ts` 中的 `sidebar` 部分。

## 部署到 GitHub Pages

1. 推送代码到 GitHub
2. 进入仓库 Settings > Pages
3. Source 选择 **GitHub Actions**
4. 推送到 main 分支会自动触发构建和部署

如需自定义域名，取消注释 `docs/.vitepress/config.ts` 中的 `base` 配置。

## 目录结构

```
├── docs/
│   ├── .vitepress/
│   │   ├── config.ts           # VitePress 配置
│   │   └── theme/              # 自定义主题
│   ├── articles/               # 文章目录
│   ├── index.md                # 首页
│   ├── categories.md           # 分类页
│   ├── tags.md                 # 标签页
│   ├── archive.md              # 归档页
│   └── about.md                # 关于页
├── .github/workflows/deploy.yml
├── package.json
└── README.md
```

## 许可

MIT License
