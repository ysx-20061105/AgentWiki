/**
 * Search Module
 * 基于 index.json 的前端全文搜索
 */
const Search = (() => {
  let articles = [];

  /**
   * 加载文章索引
   */
  async function init(articleData) {
    articles = articleData || [];
  }

  /**
   * 执行搜索
   */
  function search(query) {
    if (!query || !query.trim()) return [];
    const q = query.toLowerCase().trim();
    const keywords = q.split(/\s+/);

    return articles
      .map(article => {
        let score = 0;
        const titleLower = (article.title || '').toLowerCase();
        const summaryLower = (article.summary || '').toLowerCase();
        const tagsStr = (article.tags || []).join(' ').toLowerCase();
        const categoryLower = (article.category || '').toLowerCase();

        keywords.forEach(kw => {
          if (titleLower.includes(kw)) score += 10;
          if (tagsStr.includes(kw)) score += 5;
          if (categoryLower.includes(kw)) score += 3;
          if (summaryLower.includes(kw)) score += 2;
        });

        return { ...article, score };
      })
      .filter(a => a.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * 高亮关键词
   */
  function highlightText(text, query) {
    if (!query || !text) return text;
    const keywords = query.toLowerCase().trim().split(/\s+/);
    let result = text;
    keywords.forEach(kw => {
      if (!kw) return;
      const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
    });
    return result;
  }

  return { init, search, highlightText };
})();
