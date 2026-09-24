// ==UserScript==
// @name         GitHub Gist Control Panel
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Adds a control panel, keyboard shortcuts, and one-click copy buttons to Gists.
// @author       ItzMeShadow999
// @homepageURL  https://github.com/ItzMeShadow999/Github-QOL
// @supportURL   https://github.com/ItzMeShadow999/Github-QOL/issues
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/GitHub_Gist_Control_Panel.user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/GitHub_Gist_Control_Panel.user.js
// @match        https://gist.github.com/*
// @icon         https://i.ibb.co/XxSnS9h9/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const copyIcon = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>`; // SVG icons, so fancy
    const checkIcon = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>`;

    function createUI() {
        if (document.getElementById('shadow-control-panel')) return; // Already exists, chill

        const target = document.querySelector('.gh-header-actions, .pagehead-actions, .file-navigation, #repository-container-header'); // GitHub's selectors are so consistent
        if (!target) return; // Can't find it? Oh well

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
        legend.innerText = 'Shortcuts: [Alt+E] Edit | [Alt+R] Raw View | [Alt+C] Copy Gist ID'; // Memorize these or suffer

        panel.appendChild(legend);

        const headerContainer = target.closest('.gh-header, .pagehead, #repository-container-header');
        if (headerContainer) {
            headerContainer.appendChild(panel); // Found it, nice
        } else {
            target.parentNode.insertBefore(panel, target); // Plan B, whatever works
        }
    }

    function addCopyButtons() {
        const codeBlocks = document.querySelectorAll('.markdown-body pre, .blob-wrapper'); // Find all the code blocks

        codeBlocks.forEach(block => {
            if (
                block.classList.contains('has-copy-button') || 
                block.querySelector('clipboard-copy') ||
                block.offsetWidth === 0 // Hidden element? Don't bother
            ) {
                return;
            }
            block.classList.add('has-copy-button'); // Mark it so I don't do it again

            const button = document.createElement('button');
            button.innerHTML = copyIcon;
            button.setAttribute('aria-label', 'Copy to clipboard'); // Accessibility matters or whatever
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
                block.style.position = 'relative'; // Gotta make it relative for absolute positioning, duh
            }

            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = 'var(--button-default-bgColor-hover, #30363d)'; // Hover effects, so fancy
                button.style.borderColor = 'var(--borderColor-muted, #8b949e)';
                button.style.color = 'var(--fgColor-default, #c9d1d9)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = 'var(--button-default-bgColor-rest, #21262d)';
                button.style.borderColor = 'var(--borderColor-default, #30363d)';
                button.style.color = 'var(--fgColor-muted, #8b949e)';
            });

            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't trigger other stuff

                const targetEl = block.querySelector('code') || block;
                let textToCopy = targetEl.textContent.replace(/\u200B/g, '').trim(); // Remove those invisible characters
                GM_setClipboard(textToCopy); // Copy it to clipboard, magic

                button.innerHTML = checkIcon; // Show checkmark
                button.style.color = '#3fb950'; // Green for success obv
                button.style.borderColor = '#3fb950';

                setTimeout(() => {
                    button.innerHTML = copyIcon;
                    button.style.color = 'var(--fgColor-muted, #8b949e)';
                    button.style.borderColor = 'var(--borderColor-default, #30363d)';
                }, 2000); // 2 seconds, plenty of time
            });

            block.appendChild(button); // Add the button to block
        });
    }

    function initAll() {
        createUI(); // Make UI
        addCopyButtons(); // Add buttons
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll); // patient
    } else {
        initAll();
    }

    document.addEventListener('turbo:load', initAll); // GitHub uses Turbo, we use Turbo

    const observer = new MutationObserver(() => {
        addCopyButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true }); // Watch everything

    window.addEventListener('keydown', function(e) {
        const activeTag = document.activeElement.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement.isContentEditable) {
            return; // Don't trigger shortcuts when typing, that would be annoying
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
                const gistId = pathParts[1]; // Corrected index after filtering out empty path entries
                if (gistId) GM_setClipboard(gistId);
            }
        }
    }, true); // Use capture phase, why not

})();
