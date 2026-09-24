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
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SNIPPET_SELECTOR = '.gist-snippet'; // Because GitHub's class names are so predictable.

  // Hot singles in your area? We got you covered.
  const RULES = [
    { label: 'crypto/airdrop scam', re: /\b(airdrop|free\s*bitcoin|usdt\s*flash|claim\s*your\s*(reward|bonus))\b/i }, // Free money, totally legit.
    { label: 'wallet address dump', re: /0x[a-fA-F0-9]{40}/ }, // Random hex strings, how convincing.
    { label: 'mod apk / crack site', re: /\b(mod\s*apk|cracked?\s*(version|download)|keygen|nulled)\b/i }, // Because paying for apps is for losers.
    { label: 'telegram/whatsapp spam', re: /\b(t\.me\/|wa\.me\/|join\s*(our|my)\s*telegram)\b/i }, // Join our group, we have cookies.
    { label: 'adult content spam', re: /\b(onlyfans|leaked\s*(nudes|videos)|18\+\s*content)\b/i }, // The internet's favorite content.
    { label: 'streaming piracy spam', re: /\b(watch\s*free|123movies|putlocker|hd\s*streaming\s*free)\b/i }, // Free movies, what could go wrong?
    { label: 'mrbeast scam', re: /\b(mrbeast|mr\.?beast|\$1000|giveaway|iphone\s*15\s*free)\b/i }, // Totally the real MrBeast giving away iPhones.
    { label: 'non-latin keyword stuffing', re: /[\u0600-\u06FF\u0E00-\u0E7F\u0400-\u04FF]{15,}/ }, // Characters you can't read? Must be important.
  ];

  const state = {
    hiddenCount: 0, // Keeping track of all the junk we're saving you from.
    hiddenNodes: new Set(), // Because Sets are fancy and we're fancy.
    revealed: false, // Hidden by default, because who wants to see spam?
  };

  function reasonFor(text) {
    // Check if the text matches any of our super sophisticated spam patterns.
    for (const rule of RULES) {
      if (rule.re.test(text)) return rule.label; // Found it! You're welcome.
    }
    return null; // Must be legitimate content. Or just veryy clever spam.
  }

  function processSnippet(el) {
    if (el.dataset.spamChecked) return; // Already checked, move along.
    el.dataset.spamChecked = '1'; // Efficiency.

    const text = el.textContent || '';
    const reason = reasonFor(text);
    if (!reason) return; // Not spam, apparently srug.

    el.dataset.spamReason = reason; // Tag it for posterity.
    el.style.display = state.revealed ? '' : 'none'; // Hide it, unless you really want to see it.
    state.hiddenNodes.add(el);
    state.hiddenCount = state.hiddenNodes.size;
    updatePill(); // Let the user know we're doing our job.
  }

  function scan(root = document) {
    root.querySelectorAll(SNIPPET_SELECTOR).forEach(processSnippet); // Scan things....
  }

  let pill, countLabel, toggleBtn;

  function ensurePill() {
    if (pill) return; 
    pill = document.createElement('div');
    pill.id = 'gist-spamfilter-pill';
    Object.assign(pill.style, {
      position: 'fixed',
      top: '12px', // Top right corner, prime real estate!
      right: '12px',
      padding: '6px 12px',
      background: 'rgba(20,20,20,0.88)', // Dark mode, because we're cool asf
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
    pill.appendChild(countLabel); // This will show how much spam we saved your ahh from.

    toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Show'; // In case you actually want to see the junk unintall the script atp.
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
      state.revealed = !state.revealed; // Toggle visibility, because choices.
      state.hiddenNodes.forEach((el) => {
        el.style.display = state.revealed ? '' : 'none'; 
      });
      toggleBtn.textContent = state.revealed ? 'Hide' : 'Show'; // Update button text duh
    });
    pill.appendChild(toggleBtn);

    document.body.appendChild(pill);
  }

  function updatePill() {
    ensurePill();
    if (state.hiddenCount === 0) {
      pill.style.display = 'none'; // No spam? Hide the pill. Nothing to see here.
      return;
    }
    pill.style.display = 'flex'; // Show off our spam-filtering prowess.
    countLabel.textContent = `Filtered ${state.hiddenCount} junk gist${state.hiddenCount === 1 ? '' : 's'}`; // Grammar matters.
  }

  function observe() {
    const target = document.body;
    const observer = new MutationObserver((mutations) => { // Watch for changes, like a creep!
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return; // Not an element? Don't care.
          if (node.matches && node.matches(SNIPPET_SELECTOR)) processSnippet(node); // Direct match, easy.
          else if (node.querySelectorAll) scan(node); // Scan children, thorough as always.
        });
      }
    });
    observer.observe(target, { childList: true, subtree: true }); // Watch everything, trust nothing.
  }

  scan(); // Initial scan, get the existing junk.
  observe(); // Keep watching for new junk. Forever.
})();