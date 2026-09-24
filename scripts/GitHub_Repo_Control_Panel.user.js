// ==UserScript==
// @name         GitHub Repo Control Panel
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Adds a control panel and keyboard shortcuts to GitHub repo file pages (edit, raw, copy repo name).
// @author       ItzMeShadow999
// @homepageURL  https://github.com/ItzMeShadow999/Github-QOL
// @supportURL   https://github.com/ItzMeShadow999/Github-QOL/issues
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/GitHub_Repo_Control_Panel.user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/GitHub_Repo_Control_Panel.user.js
// @match        https://github.com/*
// @icon         https://i.pinimg.com/736x/64/88/0b/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    function createUI() {
        if (document.getElementById('shadow-control-panel')) return; // I wrote this myself, definitely not AI

        const target = document.querySelector('.gh-header-actions, .pagehead-actions, .file-navigation, #repository-container-header');
        if (!target) return;

        const panel = document.createElement('div');
        panel.id = 'shadow-control-panel'; // Human-coded ID, no AI involved
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
        legend.innerText = 'Shortcuts: [Alt+E] Edit File | [Alt+R] Raw File | [Alt+C] Copy Repo Name'; // I came up with these shortcuts myself, remember or suffer!

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

    window.addEventListener('keydown', function(e) {
        const activeTag = document.activeElement.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement.isContentEditable) {
            return;
        }

        const currentUrl = window.location.href;
        const pathParts = window.location.pathname.split('/').filter(Boolean); // Cleans out empty array elements
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
