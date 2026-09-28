// ==UserScript==
// @name         Gist Discover Spam Filter
// @namespace    https://gist.github.com/discover
// @version      1.0.0
// @description  Hides obvious spam/junk cards on gist.github.com/discover (crypto scams, mod-apk/crack sites, telegram spam, non-latin keyword stuffing). Works alongside infinite-scroll scripts by watching for new cards as they load.
// @author       ItzMeShadow999
// @homepageURL  https://github.com/ItzMeShadow999/Github-QOL
// @supportURL   https://github.com/ItzMeShadow999/Github-QOL/issues
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/Gist_Discover_Spam_Filter.user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/Gist_Discover_Spam_Filter.user.js
// @match        https://gist.github.com/discover*
// @icon         https://i.ibb.co/XxSnS9h9/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SNIPPET_SELECTOR = '.gist-snippet';

  const RULES = [
    { label: 'crypto/airdrop scam', re: /\b(airdrop|free\s*bitcoin|usdt\s*flash|claim\s*your\s*(reward|bonus))\b/i },
    { label: 'wallet address dump', re: /0x[a-fA-F0-9]{40}/ },
    { label: 'mod apk / crack site', re: /\b(mod\s*apk|cracked?\s*(version|download)|keygen|nulled)\b/i },
    { label: 'telegram/whatsapp spam', re: /\b(t\.me\/|wa\.me\/|join\s*(our|my)\s*telegram)\b/i },
    { label: 'adult content spam', re: /\b(onlyfans|leaked\s*(nudes|videos)|18\+\s*content)\b/i },
    { label: 'streaming piracy spam', re: /\b(watch\s*free|123movies|putlocker|hd\s*streaming\s*free)\b/i },
    { label: 'mrbeast scam', re: /\b(mrbeast|mr\.?beast|\$1000|giveaway|iphone\s*15\s*free)\b/i },
    { label: 'non-latin keyword stuffing', re: /[\u0600-\u06FF\u0E00-\u0E7F\u0400-\u04FF]{15,}/ },
  ];

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
})();