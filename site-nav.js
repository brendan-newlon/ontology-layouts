// The page switcher shared by the site's pages: replaces the page's title (the element with data-site-title, else the first
// header h1) with a compact button that opens a menu of the pages. Inside the one-page site (index.html, which shows each
// page in a frame and keeps them alive) a choice switches the frame; a page opened on its own goes to the site instead.
// Load it with <script src="(path to the repository root)/site-nav.js" data-page="playback" defer></script>.
(function () {
  const me = document.currentScript, root = new URL('.', me.src).href, here = me.dataset.page;
  const PAGES = [
    ['intro', 'Introduction', 'What the layouts do, in two minutes', 'docs/INTRO.html'],
    ['playback', 'Playback', 'Watch a layout work, step by step', 'tools/layout-bench/playback.html'],
    ['lab', 'Lab', 'Lay out your own graph, tidy it by hand, export it', 'tools/layout-bench/lab.html'],
    ['benchmarks', 'Benchmarks', 'The full write-up: how each step works, the comparisons, the method', 'docs/ONTOLOGY-LAYOUT-ALGORITHMS.html'],
    ['developers', 'Developer guide', 'Use the layout in your own app: one call, every option', 'docs/DEVELOPER-GUIDE.html']
  ];
  let shell = null; try { shell = window.parent !== window && window.parent.SiteShell ? window.parent.SiteShell : null; } catch (e) { shell = null; }
  // go(page, query): switch to another page (query: a search string such as "?graph=crm" handed to that page)
  function go(page, query) {
    if (shell) { shell.show(page, query || ''); return; }
    window.location.href = root + 'index.html#' + page + (query || '');
  }
  window.SiteNav = { go, inSite: !!shell, pages: PAGES, root };
  // links in a page to another page of the site (index.html#page) switch frames instead of reloading the site
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('a[href]'); if (!a || !shell || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    const u = new URL(a.href, location.href); if (u.href.split('#')[0] !== root + 'index.html' || !u.hash) return;
    const h = decodeURIComponent(u.hash.slice(1)), i = h.indexOf('?'); ev.preventDefault(); go(i < 0 ? h : h.slice(0, i), i < 0 ? '' : h.slice(i));
  });
  const css = `.sn{position:relative;display:inline-flex;align-items:center;margin:0 8px 0 0;font:inherit}
.sn-btn{display:inline-flex;align-items:center;gap:6px;font:600 15px/1.2 inherit;font-family:inherit;color:var(--ink,#1d232b);background:none;border:1px solid transparent;border-radius:7px;padding:3px 7px 3px 5px;cursor:pointer;white-space:nowrap}
.sn-btn:hover,.sn.open .sn-btn{border-color:var(--rule,#d9d6cc);background:var(--bg,#f4f3ee)}
.sn-btn .sn-site{font-weight:500;color:var(--muted,#5d6673)}.sn-btn .sn-car{font-size:10px;color:var(--muted,#5d6673)}
.sn-menu{display:none;position:absolute;left:0;top:calc(100% + 4px);z-index:1000;min-width:300px;background:var(--paper,#fff);color:var(--ink,#1d232b);border:1px solid var(--rule,#d9d6cc);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:6px}
.sn.open .sn-menu{display:block}
.sn-menu a{display:block;padding:7px 10px;border-radius:7px;color:inherit;text-decoration:none}
.sn-menu a:hover,.sn-menu a:focus{background:var(--bg,#f4f3ee);outline:none}
.sn-menu a.cur{box-shadow:inset 3px 0 0 var(--accent,#2f6b4f)}
.sn-menu b{display:block;font-size:14px}.sn-menu small{display:block;font-size:12px;color:var(--muted,#5d6673);margin-top:1px}`;
  function mount() {
    const el = document.querySelector('[data-site-title]') || document.querySelector('header h1'); if (!el) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const cur = PAGES.find((p) => p[0] === here) || PAGES[0], box = document.createElement('div'); box.className = 'sn';
    box.innerHTML = `<button class="sn-btn" aria-haspopup="true" aria-expanded="false" title="Switch page"><span class="sn-site">Ontology Layouts ·</span> ${cur[1]} <span class="sn-car">▾</span></button>`
      + `<div class="sn-menu" role="menu">${PAGES.map((p) => `<a role="menuitem" href="${root}index.html#${p[0]}" data-p="${p[0]}" class="${p[0] === here ? 'cur' : ''}"><b>${p[1]}</b><small>${p[2]}</small></a>`).join('')}</div>`;
    el.replaceWith(box);
    const btn = box.querySelector('.sn-btn'), open = (on) => { box.classList.toggle('open', on); btn.setAttribute('aria-expanded', on); };
    btn.onclick = (ev) => { ev.stopPropagation(); open(!box.classList.contains('open')); };
    box.querySelector('.sn-menu').onclick = (ev) => { const a = ev.target.closest('a'); if (!a) return; ev.preventDefault(); open(false); if (a.dataset.p !== here) go(a.dataset.p); };
    document.addEventListener('click', () => open(false)); document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') open(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
