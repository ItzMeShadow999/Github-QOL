// ==UserScript==
// @name         Gist Discover Doomscroll
// @namespace    https://gist.github.com/discover
// @version      1.0.0
// @description  Infinite scroll for gist.github.com/discover — keeps loading new pages of gists as you scroll, forever.
// @author       ItzMeShadow999
// @homepageURL  https://github.com/ItzMeShadow999/Github-QOL
// @supportURL   https://github.com/ItzMeShadow999/Github-QOL/issues
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/Gist_Discover_Doomscroll.user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/Gist_Discover_Doomscroll.user.js
// @match        https://gist.github.com/discover*
// @icon         https://i.ibb.co/XxSnS9h9/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SNIPPET_SELECTOR = '.gist-snippet';   
  const PAGINATION_SELECTOR = '.pagination, .paginate-container';
  const PRELOAD_MARGIN = '1200px';
  const MIN_DELAY_MS = 400;
  const state = {
    page: getPageFromUrl(location.href),
    loading: false,
    finished: false,
    paused: false,
    loadedPages: 1,
  };

  function getPageFromUrl(url) {
    const n = parseInt(new URL(url).searchParams.get('page'), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function buildNextUrl() {
    const u = new URL(location.href);
    u.searchParams.set('page', state.page + 1);
    return u.toString();
  }

  function findListContainer() {
    const items = document.querySelectorAll(SNIPPET_SELECTOR);
    if (!items.length) return null;
    return items[items.length - 1].parentElement;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  let statusEl, toggleBtn;

  function ensureUI() {
    if (statusEl) return;

    statusEl = document.createElement('div');
    statusEl.id = 'doomscroll-status';
    Object.assign(statusEl.style, {
      position: 'fixed',
      bottom: '18px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 14px',
      background: 'rgba(20,20,20,0.88)',
      color: '#fff',
      borderRadius: '999px',
      fontSize: '13px',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      zIndex: 999999,
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      pointerEvents: 'auto',
    });

    const label = document.createElement('span');
    label.id = 'doomscroll-status-text';
    statusEl.appendChild(label);

    toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Pause';
    Object.assign(toggleBtn.style, {
      background: '#fff',
      color: '#111',
      border: 'none',
      borderRadius: '999px',
      padding: '3px 10px',
      fontSize: '12px',
      cursor: 'pointer',
    });
    toggleBtn.addEventListener('click', () => {
      state.paused = !state.paused;
      toggleBtn.textContent = state.paused ? 'Resume' : 'Pause';
      if (!state.paused) maybeLoadMore();
    });
    statusEl.appendChild(toggleBtn);

    document.body.appendChild(statusEl);
  }

  function setStatus(text) {
    ensureUI();
    statusEl.style.display = 'flex';
    statusEl.querySelector('#doomscroll-status-text').textContent = text;
  }

  async function loadNextPage() {
    if (state.loading || state.finished || state.paused) return;
    state.loading = true;
    setStatus(`Loading page ${state.page + 1}…`);

    try {
      await sleep(MIN_DELAY_MS);
      const res = await fetch(buildNextUrl(), { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const newItems = Array.from(doc.querySelectorAll(SNIPPET_SELECTOR));

      if (!newItems.length) {
        state.finished = true;
        setStatus("You've reached the end — no more gists.");
        return;
      }

      const container = findListContainer();
      if (!container) {
        state.finished = true;
        setStatus('Lost track of the gist list — stopping.');
        return;
      }

      const frag = document.createDocumentFragment();
      newItems.forEach((item) => frag.appendChild(document.importNode(item, true)));
      container.appendChild(frag);

      state.page += 1;
      state.loadedPages += 1;
      history.replaceState(null, '', buildCurrentUrlDisplay());
      setStatus(`Loaded ${state.loadedPages} pages · scroll for more`);
    } catch (err) {
      console.error('[Gist Doomscroll]', err);
      setStatus('Error loading more — will retry on next scroll.');
    } finally {
      state.loading = false;
    }
  }

  function buildCurrentUrlDisplay() {
    const u = new URL(location.href);
    u.searchParams.set('page', state.page);
    return u.toString();
  }

  function maybeLoadMore() {
    if (!state.paused) loadNextPage();
  }

  function setupSentinel() {
    const container = findListContainer();
    if (!container) {
      setTimeout(setupSentinel, 500);
      return;
    }

    const sentinel = document.createElement('div');
    sentinel.id = 'doomscroll-sentinel';
    sentinel.style.height = '1px';
    container.after(sentinel);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) maybeLoadMore();
        });
      },
      { rootMargin: `${PRELOAD_MARGIN} 0px ${PRELOAD_MARGIN} 0px` }
    );
    observer.observe(sentinel);
  }

  function hideNativePagination() {
    document.querySelectorAll(PAGINATION_SELECTOR).forEach((el) => {
      el.style.display = 'none';
    });
  }

  function init() {
    hideNativePagination();
    setupSentinel();
    setStatus('Doomscroll active · scroll to load more gists');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();