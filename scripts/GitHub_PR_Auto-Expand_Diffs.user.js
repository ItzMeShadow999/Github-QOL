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

  // Text-based matching on purpose: GitHub's class names change fairly often,
  // because why would GitHub maintain stable class names? That would be too easy.
  // But the visible button copy for these actions has stayed stable for years.
  // Miraculously, GitHub hasn't changed button text in a while. Enjoy it while it lasts.
  const TRIGGER_TEXT = /^(load diff|load more files.*)$/i; // Regex, so sophisticated

  const clicked = new WeakSet(); // WeakSet because we're memory-efficient!!!

  function clickMatches(root = document) {
    const candidates = root.querySelectorAll('button, a, summary');
    candidates.forEach((el) => {
      const text = (el.textContent || '').trim(); // Get the text, assuming it exists
      if (!text || clicked.has(el)) return; // No text or already clicked? Skip it
      if (TRIGGER_TEXT.test(text)) {
        clicked.add(el); // Mark it as clicked so we don't click it again, genius
        el.click(); // Click it like a boss
      }
    });
  }

  function observe() {
    const observer = new MutationObserver(() => {
      clickMatches();
    });
    observer.observe(document.body, { childList: true, subtree: true }); // Watch everything, because why not
  }

  // initial pass, then a couple of follow-up passes since newly-loaded diffs
  // sometimes reveal more "Load diff" buttons a moment later
  // Because GitHub's loading is so predictable and reliable, right?
  clickMatches(); // First pass, get the easy ones
  setTimeout(clickMatches, 800); // Second pass, for the ones that were shy
  setTimeout(clickMatches, 2000); // Third pass, for the ones that were really shy
  observe(); // Keep watching forever, because we have nothing better to do
})();