// ==UserScript==
// @name         Master GitHub UserScript
// @namespace    itzmeshadow999.master-github
// @version      1.0
// @description  All-in-one: Repo Control Panel (shortcuts), Notification Favicon Badge, and PR Auto-Expand Diffs.
// @author       ItzMeShadow999
// @homepageURL  https://github.com/ItzMeShadow999/Github-QOL
// @supportURL   https://github.com/ItzMeShadow999/Github-QOL/issues
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/master/Master_GitHub_UserScript.user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/master/Master_GitHub_UserScript.user.js
// @match        https://github.com/*
// @icon         https://i.ibb.co/XxSnS9h9/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

// merging 3 scripts wasn't actually that bad, only took 2 cups of coffee
(function () {
    'use strict';

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
        legend.innerText = 'Shortcuts: [Alt+E] Edit File | [Alt+R] Raw File | [Alt+C] Copy Repo Name';

        panel.appendChild(legend);

        const headerContainer = target.closest('.gh-header, .pagehead, #repository-container-header');
        if (headerContainer) {
            headerContainer.appendChild(panel);
        } else {
            target.parentNode.insertBefore(panel, target);
        }
    }

    function initAll() {
        createUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }

    document.addEventListener('turbo:load', initAll);

    window.addEventListener('keydown', function (e) {
        const activeTag = document.activeElement.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement.isContentEditable) {
            return;
        }

        const currentUrl = window.location.href;
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const keyLower = e.key.toLowerCase();

        if (e.altKey && keyLower === 'e') {
            if (currentUrl.includes('/blob/')) {
                window.location.href = currentUrl.replace('/blob/', '/edit/');
            }
        }

        if (e.altKey && keyLower === 'r' && !currentUrl.includes('/edit')) {
            if (currentUrl.includes('/blob/')) {
                window.location.href = currentUrl.replace('/blob/', '/raw/');
            }
        }

        if (e.altKey && keyLower === 'c') {
            if (pathParts.length >= 2) {
                const repoIdentifier = `${pathParts[0]}/${pathParts[1]}`;
                GM_setClipboard(repoIdentifier);
            }
        }
    }, true);
})();

// the favicon badge was actually pretty chill to merge, surprisingly
(function () {
    'use strict';

    const INDICATOR_SELECTOR = '.AppHeader-button--hasIndicator, .mail-status.unread';

    let originalTitle = document.title;
    let faviconLink = document.querySelector('link[rel~="icon"]');
    let originalFaviconHref = faviconLink ? faviconLink.href : null;
    let badgeHref = null;

    function hasUnread() {
        return !!document.querySelector(INDICATOR_SELECTOR);
    }

    function buildBadgedFavicon(callback) {
        if (badgeHref || !originalFaviconHref) return callback(badgeHref);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const size = 32;
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, size, size);

                ctx.beginPath();
                ctx.arc(size - 7, 7, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(size - 7, 7, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#e5423e';
                ctx.fill();

                badgeHref = canvas.toDataURL('image/png');
            } catch (err) {
                badgeHref = null;
            }
            callback(badgeHref);
        };
        img.onerror = () => callback(null);
        img.src = originalFaviconHref;
    }

    function applyBadge(on) {
        document.title = on ? `\u25CF ${originalTitle}` : originalTitle;

        if (!faviconLink) return;
        if (!on) {
            faviconLink.href = originalFaviconHref;
            return;
        }
        buildBadgedFavicon((href) => {
            if (href) faviconLink.href = href;
        });
    }

    let lastState = null;
    function check() {
        const unread = hasUnread();
        if (unread === lastState) return;
        lastState = unread;
        applyBadge(unread);
    }

    const titleObserver = new MutationObserver(() => {
        if (lastState !== true) {
            originalTitle = document.title;
        } else if (!document.title.startsWith('\u25CF ')) {
            originalTitle = document.title;
            applyBadge(true);
        }
    });
    const titleEl = document.querySelector('head > title');
    if (titleEl) titleObserver.observe(titleEl, { childList: true });

    const bodyObserver = new MutationObserver(check);
    bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    check();
})();

// PR diff expander gave me zero issues, must be my lucky day
(function () {
    'use strict';
    if (!/^\/[^/]+\/[^/]+\/pull\//.test(location.pathname)) return; // Only run on PR pages, obviously

    const TRIGGER_TEXT = /^(load diff|load more files.*)$/i;

    const clicked = new WeakSet();

    function clickMatches(root = document) {
        const candidates = root.querySelectorAll('button, a, summary');
        candidates.forEach((el) => {
            const text = (el.textContent || '').trim();
            if (!text || clicked.has(el)) return;
            if (TRIGGER_TEXT.test(text)) {
                clicked.add(el);
                el.click();
            }
        });
    }

    function observe() {
        const observer = new MutationObserver(() => {
            clickMatches();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    clickMatches();
    setTimeout(clickMatches, 800); // Second pass for the shy buttons
    setTimeout(clickMatches, 2000); // Third pass for the really shy ones
    observe(); // Watch for new buttons like a hawk
})();

// honestly this merge was smooth, coffee helped though
