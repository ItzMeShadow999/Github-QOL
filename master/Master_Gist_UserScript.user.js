// ==UserScript==
// @name         Master Gist UserScript
// @namespace    itzmeshadow999.master-gist
// @version      1.0
// @description  All-in-one: Gist Control Panel (shortcuts + copy buttons), Gist Discover pagination controls, Gist Discover infinite scroll, and Gist Discover spam filter.
// @author       ItzMeShadow999
// @homepageURL  https://github.com/ItzMeShadow999/Github-QOL
// @supportURL   https://github.com/ItzMeShadow999/Github-QOL/issues
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/master/Master_Gist_UserScript.user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/master/Master_Gist_UserScript.user.js
// @match        https://gist.github.com/*
// @icon         https://i.pinimg.com/736x/64/88/0b/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

/* =========================================================================
 * MODULE 1: GitHub Gist Control Panel
 * Shortcuts (Alt+E edit / Alt+R raw / Alt+C copy gist id) + copy buttons.
 * Runs on all gist.github.com pages.
 * ========================================================================= */
(function () {
    'use strict';

    // merging these 4 separate scripts was a nightmare, so many variable conflicts

    const copyIcon = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>`;
    const checkIcon = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>`;

    function createUI() {
        if (document.getElementById('shadow-control-panel')) return;

        const target = document.querySelector('.gh-header-actions, .pagehead-actions, .file-navigation, #repository-container-header');
        if (!target) return;

        const panel = document.createElement('div');
        panel.id = 'shadow-control-panel';
        panel.style.cssText = `
            background-color: var(--bgColor-muted, #161b22);
            border: 1px solid var(--borderColor-default, #30363d);
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 16px;
            display: flex;
            gap: 10px;
            align-items: center;
            font-size: 12px;
            clear: both;
            width: fit-content;
        `;

        const legend = document.createElement('span');
        legend.style.color = 'var(--fgColor-muted, #8b949e)';
        legend.innerText = 'Shortcuts: [Alt+E] Edit | [Alt+R] Raw View | [Alt+C] Copy Gist ID';

        panel.appendChild(legend);

        const headerContainer = target.closest('.gh-header, .pagehead, #repository-container-header');
        if (headerContainer) {
            headerContainer.appendChild(panel);
        } else {
            target.parentNode.insertBefore(panel, target);
        }
    }

    function addCopyButtons() {
        const codeBlocks = document.querySelectorAll('.markdown-body pre, .blob-wrapper');

        codeBlocks.forEach(block => {
            if (
                block.classList.contains('has-copy-button') ||
                block.querySelector('clipboard-copy') ||
                block.offsetWidth === 0
            ) {
                return;
            }
            block.classList.add('has-copy-button');

            const button = document.createElement('button');
            button.innerHTML = copyIcon;
            button.setAttribute('aria-label', 'Copy to clipboard');
            button.style.cssText = `
                position: absolute;
                right: 10px;
                top: 10px;
                z-index: 100;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                padding: 0;
                background-color: var(--button-default-bgColor-rest, #21262d);
                color: var(--fgColor-muted, #8b949e);
                border: 1px solid var(--borderColor-default, #30363d);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            `;

            if (window.getComputedStyle(block).position === 'static') {
                block.style.position = 'relative';
            }

            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = 'var(--button-default-bgColor-hover, #30363d)';
                button.style.borderColor = 'var(--borderColor-muted, #8b949e)';
                button.style.color = 'var(--fgColor-default, #c9d1d9)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = 'var(--button-default-bgColor-rest, #21262d)';
                button.style.borderColor = 'var(--borderColor-default, #30363d)';
                button.style.color = 'var(--fgColor-muted, #8b949e)';
            });

            button.addEventListener('click', (e) => {
                e.stopPropagation();

                const targetEl = block.querySelector('code') || block;
                let textToCopy = targetEl.textContent.replace(/\u200B/g, '').trim();
                GM_setClipboard(textToCopy);

                button.innerHTML = checkIcon;
                button.style.color = '#3fb950';
                button.style.borderColor = '#3fb950';

                setTimeout(() => {
                    button.innerHTML = copyIcon;
                    button.style.color = 'var(--fgColor-muted, #8b949e)';
                    button.style.borderColor = 'var(--borderColor-default, #30363d)';
                }, 2000);
            });

            block.appendChild(button);
        });
    }

    function initAll() {
        createUI();
        addCopyButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }

    document.addEventListener('turbo:load', initAll);

    const panelObserver = new MutationObserver(() => {
        addCopyButtons();
    });
    panelObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('keydown', function (e) {
        const activeTag = document.activeElement.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement.isContentEditable) {
            return;
        }

        const currentUrl = window.location.href;
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const keyLower = e.key.toLowerCase();

        if (e.altKey && keyLower === 'e') {
            if (pathParts.length >= 2 && !currentUrl.includes('/edit')) {
                window.location.href = currentUrl.split(/[?#]/)[0] + '/edit';
            }
        }

        if (e.altKey && keyLower === 'r' && !currentUrl.includes('/edit')) {
            const rawLink = document.querySelector('a[href*="/raw"]');
            if (rawLink) window.location.href = rawLink.href;
        }

        if (e.altKey && keyLower === 'c') {
            if (pathParts.length >= 2) {
                const gistId = pathParts[1];
                if (gistId) GM_setClipboard(gistId);
            }
        }
    }, true);
})();

(function () {
    'use strict';
    if (!location.pathname.startsWith('/discover')) return;

    // had to rewrite the entire pagination logic because of scope issues

    function getPage() {
        const params = new URLSearchParams(location.search);
        const p = parseInt(params.get('page'), 10);
        return Number.isFinite(p) && p > 0 ? p : 1;
    }

    function goToPage(page) {
        const target = Math.max(1, page);
        const params = new URLSearchParams(location.search);
        params.set('page', target);
        location.href = `${location.pathname}?${params.toString()}`;
    }

    function buildBar() {
        const current = getPage();

        const bar = document.createElement('div');
        bar.id = 'gdp-bar';
        bar.style.cssText = `
          display: flex;
          align-items: center;
          gap: 10px;
          justify-content: center;
          padding: 16px 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        `;

        const mkBtn = (label, disabled, onClick) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.disabled = disabled;
            btn.style.cssText = `
            padding: 6px 14px;
            border-radius: 6px;
            border: 1px solid var(--borderColor-default, #3d444d);
            background: var(--bgColor-default, #151b23);
            color: var(--fgColor-default, #f0f6fc);
            cursor: ${disabled ? 'default' : 'pointer'};
            opacity: ${disabled ? 0.4 : 1};
            font-size: 13px;
          `;
            if (!disabled) btn.addEventListener('click', onClick);
            return btn;
        };

        const prevBtn = mkBtn('← Prev', current <= 1, () => goToPage(current - 1));
        const nextBtn = mkBtn('Next →', false, () => goToPage(current + 1));

        const label = document.createElement('span');
        label.textContent = `Page ${current}`;
        label.style.cssText = 'font-size: 13px; opacity: 0.8; min-width: 70px; text-align: center;';

        const jumpInput = document.createElement('input');
        jumpInput.type = 'number';
        jumpInput.min = '1';
        jumpInput.placeholder = 'jump…';
        jumpInput.style.cssText = `
          width: 70px;
          padding: 5px 8px;
          border-radius: 6px;
          border: 1px solid var(--borderColor-default, #3d444d);
          background: var(--bgColor-default, #151b23);
          color: var(--fgColor-default, #f0f6fc);
          font-size: 13px;
        `;
        jumpInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && jumpInput.value) {
                goToPage(parseInt(jumpInput.value, 10));
            }
        });

        const jumpBtn = mkBtn('Go', false, () => {
            if (jumpInput.value) goToPage(parseInt(jumpInput.value, 10));
        });

        bar.append(prevBtn, label, nextBtn, jumpInput, jumpBtn);
        return bar;
    }

    function mount() {
        document.querySelectorAll('#gdp-bar').forEach(el => el.remove());

        const bar = buildBar();
        const main = document.querySelector('main') || document.body;
        main.prepend(bar);
        main.appendChild(bar.cloneNode(true));

        const bars = document.querySelectorAll('#gdp-bar');
        bars.forEach((b, i) => {
            if (i === 0) return;
            const current = getPage();
            const [prevBtn, , nextBtn, jumpInput, jumpBtn] = b.children;
            if (current > 1) prevBtn.addEventListener('click', () => goToPage(current - 1));
            nextBtn.addEventListener('click', () => goToPage(current + 1));
            jumpBtn.addEventListener('click', () => {
                if (jumpInput.value) goToPage(parseInt(jumpInput.value, 10));
            });
            jumpInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && jumpInput.value) goToPage(parseInt(jumpInput.value, 10));
            });
        });
    }

    mount();

    document.addEventListener('turbo:load', mount);
    document.addEventListener('turbo:render', mount);
})();

(function () {
    'use strict';
    if (!location.pathname.startsWith('/discover')) return;

    // the doomscroll module kept breaking the pagination, took forever to fix

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

(function () {
    'use strict';
    if (!location.pathname.startsWith('/discover')) return;

    // spam filter regex patterns kept conflicting with other modules

    const SNIPPET_SELECTOR = '.gist-snippet';

    const RULES = [
        { label: 'crypto/airdrop scam', re: /\b(airdrop|free\s*bitcoin|usdt\s*flash|claim\s*your\s*(reward|bonus))\b/i },
        { label: 'wallet address dump', re: /0x[a-fA-F0-9]{40}/ },
        { label: 'mod apk / crack site', re: /\b(mod\s*apk|cracked?\s*(version|download)|keygen|nulled)\b/i },
        { label: 'telegram/whatsapp spam', re: /\b(t\.me\/|wa\.me\/|join\s*(our|my)\s*telegram)\b/i },
        { label: 'adult content spam', re: /\b(onlyfans|leaked\s*(nudes|videos)|18\+\s*content)\b/i },
        { label: 'streaming piracy spam', re: /\b(watch\s*free|123movies|putlocker|hd\s*streaming\s*free)\b/i },
        { label: 'non-latin keyword stuffing', re: /[\u0600-\u06FF\u0E00-\u0E7F\u0400-\u04FF]{15,}/ },
    ];

    // spent hours debugging why the filter wasn't working with infinite scroll

    const state = {
        hiddenCount: 0,
        hiddenNodes: new Set(),
        revealed: false,
    };

    function reasonFor(text) {
        for (const rule of RULES) {
            if (rule.re.test(text)) return rule.label;
        }
        return null;
    }

    function processSnippet(el) {
        if (el.dataset.spamChecked) return;
        el.dataset.spamChecked = '1';

        const text = el.textContent || '';
        const reason = reasonFor(text);
        if (!reason) return;

        el.dataset.spamReason = reason;
        el.style.display = state.revealed ? '' : 'none';
        state.hiddenNodes.add(el);
        state.hiddenCount = state.hiddenNodes.size;
        updatePill();
    }

    function scan(root = document) {
        root.querySelectorAll(SNIPPET_SELECTOR).forEach(processSnippet);
    }

    let pill, countLabel, toggleBtn;

    function ensurePill() {
        if (pill) return;
        pill = document.createElement('div');
        pill.id = 'gist-spamfilter-pill';
        Object.assign(pill.style, {
            position: 'fixed',
            top: '12px',
            right: '12px',
            padding: '6px 12px',
            background: 'rgba(20,20,20,0.88)',
            color: '#fff',
            borderRadius: '999px',
            fontSize: '12px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            zIndex: 999999,
            display: 'none',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        });

        countLabel = document.createElement('span');
        pill.appendChild(countLabel);

        toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Show';
        Object.assign(toggleBtn.style, {
            background: '#fff',
            color: '#111',
            border: 'none',
            borderRadius: '999px',
            padding: '2px 9px',
            fontSize: '11px',
            cursor: 'pointer',
        });
        toggleBtn.addEventListener('click', () => {
            state.revealed = !state.revealed;
            state.hiddenNodes.forEach((el) => {
                el.style.display = state.revealed ? '' : 'none';
            });
            toggleBtn.textContent = state.revealed ? 'Hide' : 'Show';
        });
        pill.appendChild(toggleBtn);

        document.body.appendChild(pill);
    }

    function updatePill() {
        ensurePill();
        if (state.hiddenCount === 0) {
            pill.style.display = 'none';
            return;
        }
        pill.style.display = 'flex';
        countLabel.textContent = `Filtered ${state.hiddenCount} junk gist${state.hiddenCount === 1 ? '' : 's'}`;
    }

    function observe() {
        const target = document.body;
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                m.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    if (node.matches && node.matches(SNIPPET_SELECTOR)) processSnippet(node);
                    else if (node.querySelectorAll) scan(node);
                });
            }
        });
        observer.observe(target, { childList: true, subtree: true });
    }

    scan();
    observe();
    // finally got everything working together after like 500 console errors
})();
