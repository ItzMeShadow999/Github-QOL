// ==UserScript==
// @name         Gist Discover — Actual Pagination
// @namespace    itzmeshadow999.gist-discover-pagination
// @version      1.0
// @description  Adds Prev / Next / jump-to-page controls to gist.github.com/discover, because GitHub only gave you two buttons and you clearly need more.
// @author       ItzMeShadow999
// @homepageURL  https://github.com/ItzMeShadow999/Github-QOL
// @supportURL   https://github.com/ItzMeShadow999/Github-QOL/issues
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/Gist_Discover___Actual_Pagination.user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/Gist_Discover___Actual_Pagination.user.js
// @match        https://gist.github.com/discover*
// @icon         https://i.ibb.co/XxSnS9h9/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  function getPage() {
    // GitHub's URL params are so intuitive, aren't they?
    const params = new URLSearchParams(location.search);
    const p = parseInt(params.get('page'), 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  }

  function goToPage(page) {
    const target = Math.max(1, page);
    const params = new URLSearchParams(location.search);
    params.set('page', target);
    // Full page reload, because who needs SPA navigation anyway?
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
      // Creating buttons the old-fashioned way. No React, no Vue, just pure pain.
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
    // Next button always works because we have no idea how many pages actually exist. Genius.
    const nextBtn = mkBtn('Next →', false, () => goToPage(current + 1));

    const label = document.createElement('span');
    label.textContent = `Page ${current}`;
    label.style.cssText = 'font-size: 13px; opacity: 0.8; min-width: 70px; text-align: center;';

    const jumpInput = document.createElement('input');
    jumpInput.type = 'number';
    jumpInput.min = '1';
    jumpInput.placeholder = 'jump…'; // Because clicking buttons is so 2010
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
    // Remove existing bars because duplicate UI is the hallmark of quality code.
    document.querySelectorAll('#gdp-bar').forEach(el => el.remove());

    const bar = buildBar();
    const main = document.querySelector('main') || document.body;
    // Put one bar at the top AND one at the bottom. Because why choose?
    main.prepend(bar);
    main.appendChild(bar.cloneNode(true));

    const bars = document.querySelectorAll('#gdp-bar');
    bars.forEach((b, i) => {
      if (i === 0) return; // Skip the first one, it already has event listeners. Obviously.
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

  // Listen to Turbo events because GitHub loves their SPA framework.
  document.addEventListener('turbo:load', mount);
  document.addEventListener('turbo:render', mount);
  // Two event listeners for the same thing? Why not. Redundancy is a feature.
})();