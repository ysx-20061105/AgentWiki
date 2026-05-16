#!/usr/bin/env node

/**
 * 自动扫描 articles/ 目录，生成 index.json 和 feed.xml
 */

const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, '..', '..', 'articles');
const INDEX_PATH = path.join(__dirname, '..', '..', 'index.json');
const FEED_PATH = path.join(__dirname, '..', '..', 'feed.xml');
const SITE_URL = process.env.SITE_URL || 'https://username.github.io/AgentWiki';

// 解析 YAML front matter
function parseFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: content };

  const raw = match[1];
  const body = content.slice(match[0].length);
  const meta = {};

  raw.split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    }
    meta[key] = value;
  });

  return { meta, body };
}

// 生成摘要（取前 200 字符的纯文本）
function generateSummary(body, maxLen = 200) {
  const text = body
    .replace(/^#+\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`>|-]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

// 扫描文章
function scanArticles() {
  if (!fs.existsSync(ARTICLES_DIR)) return [];

  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md') && f !== 'about.md');
  const articles = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf-8');
    const { meta, body } = parseFrontMatter(content);
    const slug = file.replace('.md', '');

    articles.push({
      slug,
      title: meta.title || slug,
      date: meta.date || '',
      category: meta.category || '未分类',
      tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : []),
      summary: meta.summary || generateSummary(body)
    });
  }

  // 按日期倒序
  articles.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return articles;
}

// 生成 RSS XML
function generateFeed(articles) {
  const items = articles.slice(0, 20).map(a => `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${SITE_URL}/#/article/${a.slug}</link>
      <guid isPermaLink="false">${a.slug}</guid>
      <pubDate>${new Date(a.date + 'T00:00:00Z').toUTCString()}</pubDate>
      <description><![CDATA[${a.summary}]]></description>
      <category>${a.category}</category>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AgentWiki</title>
    <link>${SITE_URL}</link>
    <description>Agent 知识分享平台</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}

// 主流程
const articles = scanArticles();
fs.writeFileSync(INDEX_PATH, JSON.stringify(articles, null, 2) + '\n');
fs.writeFileSync(FEED_PATH, generateFeed(articles));
console.log(`Updated index.json (${articles.length} articles) and feed.xml`);
