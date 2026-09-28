// ==UserScript==
// @name         GitHub PR Auto-Expand Diffs
// @namespace    https://github.com
// @version      1.0.0
// @description  Automatically clicks every "Load diff" and "Load more files" button on a GitHub pull request's Files changed tab, so big PRs show up fully without manual clicking.
// @author       ItzMeShadow999
// @homepageURL  https://github.com/ItzMeShadow999/Github-QOL
// @supportURL   https://github.com/ItzMeShadow999/Github-QOL/issues
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/GitHub_PR_Auto-Expand_Diffs.user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/GitHub_PR_Auto-Expand_Diffs.user.js
// @match        https://github.com/*/*/pull/*
// @icon         https://i.ibb.co/XxSnS9h9/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

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
  setTimeout(clickMatches, 800);
  setTimeout(clickMatches, 2000);
  observe();
})();