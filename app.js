/* app.js — 把 posts.js 里的数据变成页面
   ────────────────────────────────────────────────────────────
   做了四件事：
     1. 把 POSTS 渲染成按年份分组的列表
     2. 用网址 # 号后面那段做「路由」，让每篇日志有自己的链接
     3. 深浅色切换（记住你的选择）
     4. 滚动到视口时才淡入（IntersectionObserver）
   ──────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // 标记「脚本已经跑起来了」，CSS 才会启用淡入动画
  document.documentElement.classList.add('js');

  const $ = (sel, root = document) => root.querySelector(sel);
  const root = document.documentElement;

  /* ───────────────────────── 1. 工具 ───────────────────────── */

  // 把 '2026-11-04' 变成 '2026.11.04'
  const fmtDate = (iso) => iso.replaceAll('-', '.');

  // 列表里只显示月日
  const shortDate = (iso) => iso.slice(5).replace('-', '.');

  // 转义 HTML，防止标题里的尖括号破坏页面
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  // 最新的排在前面。
  // 注意：日期相同时必须返回 0，否则排序结果不稳定（同一天的两篇可能乱序）。
  const posts = [...POSTS].sort((a, b) =>
    a.date === b.date ? 0 : a.date < b.date ? 1 : -1
  );

  /* ───────────────────────── 2. 深浅色 ───────────────────────── */

  const themeBtn = $('#theme');

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    themeBtn.textContent = theme === 'dark' ? '☀' : '◐';
    try { localStorage.setItem('journal-theme', theme); } catch (e) {}
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('journal-theme'); } catch (e) {}

    // 支持用 ?theme=dark 临时预览（截图、面试演示都好用）
    const fromUrl = new URLSearchParams(location.search).get('theme');
    if (fromUrl === 'dark' || fromUrl === 'light') return applyTheme(fromUrl);

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  }

  themeBtn.addEventListener('click', () => {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* ───────────────────────── 3. 渲染列表 ───────────────────────── */

  const indexView = $('#index-view');
  const postView = $('#post-view');
  const entriesRoot = $('#entries');

  function entryElement(post) {
    const li = document.createElement('li');
    li.className = 'entry';
    li.innerHTML = `
      <time datetime="${esc(post.date)}">${shortDate(post.date)}</time>
      <div class="entry-main">
        <h3><a href="#/p/${encodeURIComponent(post.slug)}">${esc(post.title)}</a></h3>
        <p>${esc(post.summary)}</p>
        ${post.tags && post.tags.length
          ? `<div class="tags">${post.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>`
          : ''}
      </div>`;
    return li;
  }

  function renderIndex() {
    entriesRoot.innerHTML = '';

    // 按年份分组：{ '2026': [...], '2025': [...] }
    const byYear = new Map();
    for (const p of posts) {
      const year = p.date.slice(0, 4);
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(p);
    }

    for (const [year, items] of byYear) {
      const block = document.createElement('section');
      block.className = 'year-block';

      const heading = document.createElement('h2');
      heading.className = 'year';
      heading.textContent = year;
      block.appendChild(heading);

      const list = document.createElement('ol');
      list.className = 'entries';
      for (const p of items) list.appendChild(entryElement(p));

      block.appendChild(list);
      entriesRoot.appendChild(block);
    }

    // 首屏统计
    const count = $('[data-count]');
    if (count) count.textContent = String(posts.length);
    if (posts.length) {
      const newest = $('[data-updated]');
      if (newest) newest.textContent = fmtDate(posts[0].date);
    }

    observeEntries();
  }

  /* ───────────────────────── 4. 渲染单篇 ───────────────────────── */

  function renderPost(slug) {
    const post = posts.find((p) => p.slug === slug);
    if (!post) return false;

    postView.innerHTML = `
      <a class="back" href="#/">← 全部日志</a>
      <h1>${esc(post.title)}</h1>
      <div class="post-meta">
        <time datetime="${esc(post.date)}">${fmtDate(post.date)}</time>
        ${(post.tags || []).map((t) => `<span>#${esc(t)}</span>`).join('')}
      </div>
      <div class="post-body">${post.body}</div>
      <div class="post-foot"><a class="back" href="#/">← 回到日志列表</a></div>`;
    return true;
  }

  /* ───────────────────────── 5. 路由 ───────────────────────── */

  function showIndex(anchor) {
    indexView.hidden = false;
    postView.hidden = true;
    postView.innerHTML = '';
    document.title = '老登不洗脸 · 学 AI 的日志';

    if (anchor) {
      const el = document.getElementById(anchor);
      if (el) {
        // 等一帧，等 hidden 生效后再滚
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function showPost(slug) {
    if (!renderPost(slug)) {
      location.hash = '#/';
      return;
    }
    indexView.hidden = true;
    postView.hidden = false;
    const post = posts.find((p) => p.slug === slug);
    document.title = `${post.title} · 学 AI 的日志`;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function route() {
    const hash = location.hash || '#/';
    const match = hash.match(/^#\/p\/(.+)$/);
    if (match) {
      showPost(decodeURIComponent(match[1]));
      return;
    }
    // #now / #about 这类是页内锚点，先回列表再滚过去
    const anchor = hash.replace(/^#\/?/, '');
    showIndex(anchor && anchor !== '/' ? anchor : null);
  }

  window.addEventListener('hashchange', route);

  // 阅读时按 Esc 回列表
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !postView.hidden) location.hash = '#/';
  });

  /* ───────────────────────── 6. 滚动淡入 ───────────────────────── */

  let observer = null;

  function observeEntries() {
    const pending = [...document.querySelectorAll('.entry:not(.is-in)')];

    if (!('IntersectionObserver' in window)) {
      pending.forEach((el) => el.classList.add('is-in'));
      return;
    }

    if (!observer) {
      observer = new IntersectionObserver(
        (items) => {
          for (const item of items) {
            if (item.isIntersecting) {
              item.target.classList.add('is-in');
              observer.unobserve(item.target);
            }
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
      );
    }

    // 关键：已经在首屏里的条目立刻显示，不等回调。
    // 否则只要观察器晚一拍（慢网络、后台标签页、自动化截图），
    // 内容就会一直是 opacity:0 —— 网页看起来像空的。
    for (const el of pending) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        el.classList.add('is-in');
      } else {
        observer.observe(el);
      }
    }
  }

  /* ───────────────────────── 启动 ───────────────────────── */

  initTheme();
  renderIndex();
  route();
})();
