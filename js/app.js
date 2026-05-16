/**
 * App - Main Application Logic & Router
 */
const App = (() => {
  let articles = [];
  const contentEl = () => document.getElementById('contentWrapper');

  /**
   * 初始化应用
   */
  async function init() {
    initTheme();
    initBackToTop();
    await loadIndex();
    Sidebar.init(articles);
    Search.init(articles);
    window.addEventListener('hashchange', route);
    route();
  }

  /**
   * 加载文章索引
   */
  async function loadIndex() {
    try {
      const resp = await fetch('index.json');
      if (resp.ok) {
        articles = await resp.json();
        // 按日期倒序
        articles.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      }
    } catch (e) {
      console.warn('加载 index.json 失败:', e);
    }
  }

  /**
   * 路由
   */
  function route() {
    const hash = window.location.hash || '#/';
    const [path, queryStr] = hash.slice(1).split('?');
    const params = new URLSearchParams(queryStr || '');

    // 滚动到顶部
    window.scrollTo(0, 0);

    if (path === '/' || path === '') {
      renderHome();
      Sidebar.setActiveNav('home');
    } else if (path.startsWith('/article/')) {
      const slug = decodeURIComponent(path.replace('/article/', ''));
      renderArticle(slug);
      Sidebar.setActiveNav('');
    } else if (path === '/categories') {
      renderCategories();
      Sidebar.setActiveNav('categories');
    } else if (path.startsWith('/category/')) {
      const name = decodeURIComponent(path.replace('/category/', ''));
      renderCategoryArticles(name);
      Sidebar.setActiveNav('categories');
    } else if (path === '/tags') {
      renderTags();
      Sidebar.setActiveNav('tags');
    } else if (path.startsWith('/tag/')) {
      const name = decodeURIComponent(path.replace('/tag/', ''));
      renderTagArticles(name);
      Sidebar.setActiveNav('tags');
    } else if (path === '/archive') {
      renderArchive();
      Sidebar.setActiveNav('archive');
    } else if (path === '/about') {
      renderAbout();
      Sidebar.setActiveNav('about');
    } else if (path === '/search') {
      const q = params.get('q') || '';
      renderSearch(q);
      Sidebar.setActiveNav('');
    } else {
      render404();
    }
  }

  // ============================================
  //  Page Renderers
  // ============================================

  function renderHome() {
    const el = contentEl();
    if (!articles.length) {
      el.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">全部文章</h1>
        </div>
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p>暂无文章，请在 articles/ 目录添加 Markdown 文件</p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">全部文章</h1>
        <p class="page-subtitle">共 ${articles.length} 篇文章</p>
      </div>
      <div class="article-list">
        ${articles.map(a => renderArticleCard(a)).join('')}
      </div>`;
  }

  function renderArticleCard(article) {
    const tags = (article.tags || []).map(t =>
      `<a href="#/tag/${encodeURIComponent(t)}" class="meta-tag">${t}</a>`
    ).join('');

    return `
      <article class="article-card" onclick="location.hash='#/article/${article.slug}'">
        <div class="article-card-header">
          <h2 class="article-card-title">
            <a href="#/article/${article.slug}">${article.title}</a>
          </h2>
          <span class="article-card-date">${formatDate(article.date)}</span>
        </div>
        ${article.summary ? `<p class="article-card-summary">${article.summary}</p>` : ''}
        <div class="article-card-meta">
          <a href="#/category/${encodeURIComponent(article.category || '未分类')}" class="meta-category">${article.category || '未分类'}</a>
          ${tags}
        </div>
      </article>`;
  }

  async function renderArticle(slug) {
    const el = contentEl();
    el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';

    try {
      const { meta, body } = await MdLoader.load(slug);
      const html = MdLoader.renderMarkdown(body);
      const { toc, html: finalHtml } = MdLoader.generateToc(html);

      // 查找上下篇
      const idx = articles.findIndex(a => a.slug === slug);
      const prev = idx < articles.length - 1 ? articles[idx + 1] : null;
      const next = idx > 0 ? articles[idx - 1] : null;

      const tags = (meta.tags || articles[idx]?.tags || []).map(t =>
        `<a href="#/tag/${encodeURIComponent(t)}" class="meta-tag">${t}</a>`
      ).join('');

      const tocHtml = toc.length > 0 ? `
        <div class="toc" id="toc">
          <div class="toc-title">目录</div>
          ${toc.map(h =>
            `<a href="#${h.id}" class="${h.level === 3 ? 'toc-h3' : ''}" data-id="${h.id}">${h.text}</a>`
          ).join('')}
        </div>` : '';

      const navHtml = (prev || next) ? `
        <div class="article-nav">
          ${prev ? `<a href="#/article/${prev.slug}" class="article-nav-link prev">
            <div class="article-nav-label">← 上一篇</div>
            <div class="article-nav-title">${prev.title}</div>
          </a>` : '<div></div>'}
          ${next ? `<a href="#/article/${next.slug}" class="article-nav-link next">
            <div class="article-nav-label">下一篇 →</div>
            <div class="article-nav-title">${next.title}</div>
          </a>` : '<div></div>'}
        </div>` : '';

      el.innerHTML = `
        <div class="article-detail">
          <a href="#/" class="back-link">← 返回文章列表</a>
          <div class="article-header">
            <h1 class="article-card-title">${meta.title || articles[idx]?.title || slug}</h1>
            <div class="article-card-meta">
              <span class="article-card-date">${formatDate(meta.date || articles[idx]?.date)}</span>
              <a href="#/category/${encodeURIComponent(meta.category || articles[idx]?.category || '未分类')}" class="meta-category">${meta.category || articles[idx]?.category || '未分类'}</a>
              ${tags}
            </div>
          </div>
          <div class="markdown-body">${finalHtml}</div>
          ${navHtml}
        </div>
        ${tocHtml}`;

      // TOC 滚动高亮
      if (toc.length > 0) {
        initTocHighlight();
      }

      // 代码高亮
      if (typeof hljs !== 'undefined') {
        el.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
      }
    } catch (e) {
      el.innerHTML = `
        <div class="empty-state">
          <p>文章加载失败: ${e.message}</p>
          <a href="#/">返回首页</a>
        </div>`;
    }
  }

  function renderCategories() {
    const el = contentEl();
    const map = {};
    articles.forEach(a => {
      const cat = a.category || '未分类';
      map[cat] = (map[cat] || 0) + 1;
    });

    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);

    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">分类</h1>
        <p class="page-subtitle">共 ${sorted.length} 个分类</p>
      </div>
      <div class="category-grid">
        ${sorted.map(([name, count]) => `
          <a href="#/category/${encodeURIComponent(name)}" class="category-card">
            <div class="category-card-name">${name}</div>
            <div class="category-card-count">${count} 篇文章</div>
          </a>
        `).join('')}
      </div>`;
  }

  function renderCategoryArticles(name) {
    const filtered = articles.filter(a => (a.category || '未分类') === name);
    const el = contentEl();

    el.innerHTML = `
      <div class="page-header">
        <a href="#/categories" class="back-link">← 返回分类</a>
        <h1 class="page-title">${name}</h1>
        <p class="page-subtitle">共 ${filtered.length} 篇文章</p>
      </div>
      <div class="article-list">
        ${filtered.map(a => renderArticleCard(a)).join('')}
      </div>`;
  }

  function renderTags() {
    const el = contentEl();
    const map = {};
    articles.forEach(a => {
      (a.tags || []).forEach(t => { map[t] = (map[t] || 0) + 1; });
    });

    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);

    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">标签</h1>
        <p class="page-subtitle">共 ${sorted.length} 个标签</p>
      </div>
      <div class="tag-list-page">
        ${sorted.map(([name, count]) => `
          <a href="#/tag/${encodeURIComponent(name)}" class="tag-item">
            ${name} <span class="count">${count}</span>
          </a>
        `).join('')}
      </div>`;
  }

  function renderTagArticles(name) {
    const filtered = articles.filter(a => (a.tags || []).includes(name));
    const el = contentEl();

    el.innerHTML = `
      <div class="page-header">
        <a href="#/tags" class="back-link">← 返回标签</a>
        <h1 class="page-title"># ${name}</h1>
        <p class="page-subtitle">共 ${filtered.length} 篇文章</p>
      </div>
      <div class="article-list">
        ${filtered.map(a => renderArticleCard(a)).join('')}
      </div>`;
  }

  function renderArchive() {
    const el = contentEl();
    // 按年月分组
    const groups = {};
    articles.forEach(a => {
      if (!a.date) return;
      const year = a.date.slice(0, 4);
      const month = a.date.slice(5, 7);
      if (!groups[year]) groups[year] = {};
      if (!groups[year][month]) groups[year][month] = [];
      groups[year][month].push(a);
    });

    const years = Object.keys(groups).sort().reverse();
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">归档</h1>
        <p class="page-subtitle">共 ${articles.length} 篇文章</p>
      </div>
      <div class="archive-timeline">
        ${years.map(year => `
          <div class="archive-year">
            <h2 class="archive-year-title">${year}</h2>
            ${Object.keys(groups[year]).sort().reverse().map(month => `
              <div class="archive-month">
                <h3 class="archive-month-title">${monthNames[parseInt(month) - 1]}</h3>
                ${groups[year][month].map(a => `
                  <div class="archive-item">
                    <span class="archive-item-date">${a.date.slice(8, 10)}日</span>
                    <span class="archive-item-title">
                      <a href="#/article/${a.slug}">${a.title}</a>
                    </span>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>`;
  }

  async function renderAbout() {
    const el = contentEl();
    el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';

    try {
      const resp = await fetch('articles/about.md');
      if (resp.ok) {
        const text = await resp.text();
        const { meta, body } = MdLoader.parseFrontMatter(text);
        const html = MdLoader.renderMarkdown(body);
        el.innerHTML = `
          <div class="page-header">
            <h1 class="page-title">${meta.title || '关于'}</h1>
          </div>
          <div class="about-content markdown-body">${html}</div>`;
      } else {
        el.innerHTML = `
          <div class="page-header">
            <h1 class="page-title">关于</h1>
          </div>
          <div class="about-content markdown-body">
            <h2>关于 AgentWiki</h2>
            <p>AgentWiki 是一个 Agent 知识分享平台，致力于分享 AI Agent 相关的技术文章、实践经验和学习资源。</p>
            <p>欢迎通过提交 Pull Request 来贡献文章！</p>
          </div>`;
      }
    } catch (e) {
      el.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">关于</h1>
        </div>
        <div class="about-content markdown-body">
          <p>AgentWiki - Agent 知识分享平台</p>
        </div>`;
    }
  }

  function renderSearch(query) {
    const el = contentEl();
    const results = Search.search(query);

    el.innerHTML = `
      <div class="page-header">
        <a href="#/" class="back-link">← 返回首页</a>
        <h1 class="page-title">搜索结果</h1>
        <p class="page-subtitle">搜索 "<span class="search-keyword">${query}</span>"，找到 ${results.length} 篇文章</p>
      </div>
      <div class="article-list">
        ${results.length > 0
          ? results.map(a => {
              const highlighted = { ...a };
              highlighted.title = Search.highlightText(a.title, query);
              highlighted.summary = Search.highlightText(a.summary || '', query);
              return renderArticleCard(highlighted);
            }).join('')
          : '<div class="empty-state"><p>未找到相关文章</p></div>'
        }
      </div>`;

    // 清空搜索框
    const input = document.getElementById('searchInput');
    if (input) input.value = query;
  }

  function render404() {
    contentEl().innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
          <circle cx="12" cy="12" r="10"/>
          <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
        <p>页面未找到</p>
        <a href="#/">返回首页</a>
      </div>`;
  }

  // ============================================
  //  Utilities
  // ============================================

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${y}年${parseInt(m)}月${parseInt(d)}日`;
  }

  // ============================================
  //  Theme
  // ============================================

  function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    setTheme(theme);

    const toggles = [document.getElementById('themeToggle'), document.getElementById('themeToggleMobile')];
    toggles.forEach(btn => {
      if (btn) btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        setTheme(next);
      });
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // 切换 highlight.js 样式
    const lightSheet = document.getElementById('hljs-light');
    const darkSheet = document.getElementById('hljs-dark');
    if (lightSheet) lightSheet.disabled = theme === 'dark';
    if (darkSheet) darkSheet.disabled = theme === 'light';
  }

  // ============================================
  //  Back to Top
  // ============================================

  function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;

    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 300);
    });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ============================================
  //  TOC Highlight
  // ============================================

  function initTocHighlight() {
    const tocLinks = document.querySelectorAll('#toc a');
    if (!tocLinks.length) return;

    const headings = [];
    tocLinks.forEach(link => {
      const target = document.getElementById(link.dataset.id);
      if (target) headings.push({ el: target, link });
    });

    const onScroll = () => {
      let current = headings[0];
      for (const h of headings) {
        if (h.el.getBoundingClientRect().top <= 100) {
          current = h;
        }
      }
      tocLinks.forEach(l => l.classList.remove('active'));
      if (current) current.link.classList.add('active');
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // 启动
  document.addEventListener('DOMContentLoaded', init);

  return { init };
})();
