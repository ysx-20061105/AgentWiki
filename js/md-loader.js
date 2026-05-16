/**
 * Markdown Loader & Parser
 * 解析 front matter 和 markdown 内容
 */
const MdLoader = (() => {
  /**
   * 解析 YAML front matter
   */
  function parseFrontMatter(text) {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) return { meta: {}, body: text };

    const raw = match[1];
    const body = text.slice(match[0].length);
    const meta = {};

    raw.split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();

      // 解析数组 [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      }
      meta[key] = value;
    });

    return { meta, body };
  }

  /**
   * 加载并解析 md 文件
   */
  async function load(slug) {
    const resp = await fetch(`articles/${slug}.md`);
    if (!resp.ok) throw new Error(`文章加载失败: ${slug}`);
    const text = await resp.text();
    return parseFrontMatter(text);
  }

  /**
   * 渲染 markdown 为 HTML
   */
  function renderMarkdown(md) {
    if (typeof marked === 'undefined') return md;

    marked.setOptions({
      gfm: true,
      breaks: false,
      highlight: function (code, lang) {
        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return code;
      }
    });

    return marked.parse(md);
  }

  /**
   * 从 HTML 中提取标题生成 TOC
   */
  function generateToc(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const headings = div.querySelectorAll('h2, h3');
    const toc = [];
    headings.forEach((h, i) => {
      const id = `heading-${i}`;
      h.id = id;
      toc.push({
        id,
        text: h.textContent,
        level: h.tagName === 'H2' ? 2 : 3
      });
    });
    return { toc, html: div.innerHTML };
  }

  return { load, renderMarkdown, generateToc, parseFrontMatter };
})();
