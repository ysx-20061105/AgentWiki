/**
 * Sidebar Module
 * 管理侧边栏交互：分类、标签、搜索
 */
const Sidebar = (() => {
  let articles = [];

  function init(articleData) {
    articles = articleData || [];
    renderCategories();
    renderTags();
    bindEvents();
  }

  /**
   * 渲染分类列表
   */
  function renderCategories() {
    const el = document.getElementById('categoryList');
    if (!el) return;

    const map = {};
    articles.forEach(a => {
      const cat = a.category || '未分类';
      map[cat] = (map[cat] || 0) + 1;
    });

    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    el.innerHTML = sorted.map(([name, count]) =>
      `<a href="#/category/${encodeURIComponent(name)}" class="sidebar-link">
        <span>${name}</span>
        <span class="count">${count}</span>
      </a>`
    ).join('');
  }

  /**
   * 渲染标签云
   */
  function renderTags() {
    const el = document.getElementById('tagList');
    if (!el) return;

    const map = {};
    articles.forEach(a => {
      (a.tags || []).forEach(t => {
        map[t] = (map[t] || 0) + 1;
      });
    });

    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    el.innerHTML = sorted.map(([name, count]) =>
      `<a href="#/tag/${encodeURIComponent(name)}" class="tag-link">${name}</a>`
    ).join('');
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    // 搜索输入
    const input = document.getElementById('searchInput');
    if (input) {
      let timer;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const q = input.value.trim();
          if (q) {
            window.location.hash = `#/search?q=${encodeURIComponent(q)}`;
          }
        }, 400);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = input.value.trim();
          if (q) {
            window.location.hash = `#/search?q=${encodeURIComponent(q)}`;
          }
        }
      });
    }

    // 移动端菜单
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
      });

      if (overlay) {
        overlay.addEventListener('click', () => {
          toggle.classList.remove('active');
          sidebar.classList.remove('open');
          overlay.classList.remove('active');
        });
      }

      // 导航点击后关闭菜单
      sidebar.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            toggle.classList.remove('active');
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
          }
        });
      });
    }
  }

  /**
   * 更新导航激活状态
   */
  function setActiveNav(page) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  }

  return { init, setActiveNav };
})();
