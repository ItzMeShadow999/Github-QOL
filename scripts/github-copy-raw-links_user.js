// ==UserScript==
// @name         GitHub Copy Raw Links
// @namespace    https://github.com/
// @version      1.2.2
// @description  Add buttons to copy GitHub file link(s) as raw.githubusercontent.com URLs (single file, whole folder listing, or all files in a PR diff)
// @author       you
// @match        https://github.com/*
// @icon         https://i.ibb.co/XxSnS9h9/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/github-copy-raw-links_user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/github-copy-raw-links_user.js
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STYLE = `
    .grl-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 8px;
      padding: 3px 8px;
      font-size: 12px;
      line-height: 18px;
      border: 1px solid var(--borderColor-default, #d0d7de);
      border-radius: 6px;
      background: var(--bgColor-default, #f6f8fa);
      color: var(--fgColor-default, #24292f);
      cursor: pointer;
    }
    .grl-btn:hover { background: var(--bgColor-muted, #eaeef2); }
    .grl-btn.grl-copied { background: #2da44e !important; color: #fff !important; border-color: #2da44e !important; }
    .grl-row-btn {
      cursor: pointer;
      opacity: 0.6;
      margin-left: 6px;
      font-size: 12px;
      user-select: none;
    }
    .grl-row-btn:hover { opacity: 1; text-decoration: underline; }
  `;
  if (typeof GM_addStyle === 'function') GM_addStyle(STYLE);
  else {
    const s = document.createElement('style');
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  const TOKEN_KEY = 'grl_github_token';
  const TOKEN_DESCRIPTION = 'Copy Raw Links UserScript';
  const TOKEN_URL = `https://github.com/settings/tokens/new?scopes=&description=${encodeURIComponent(TOKEN_DESCRIPTION)}`;
  const TOKENS_LIST_URL = 'https://github.com/settings/tokens';
  const AUTOGEN_TTL = 5 * 60 * 1000;
  const AUTO_TIMEOUT = 2 * 60 * 1000;
  const TOKEN_RE = /\b(ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/;

  let onAutoToken = null;

  function getStoredToken() {
    if (typeof GM_getValue === 'function') return GM_getValue(TOKEN_KEY, '');
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setStoredToken(token) {
    if (typeof GM_setValue === 'function') GM_setValue(TOKEN_KEY, token);
    else localStorage.setItem(TOKEN_KEY, token);
  }

  function clearStoredToken() {
    if (typeof GM_deleteValue === 'function') GM_deleteValue(TOKEN_KEY);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function apiHeaders() {
    const headers = { Accept: 'application/vnd.github+json' };
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  if (typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener('grl_autotoken', () => {
      if (onAutoToken) onAutoToken();
    });
  }

  clearStaleAutoToken();

  function clearStaleAutoToken() {
    const raw = GM_getValue('grl_autotoken', '');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (Date.now() - data.ts < AUTOGEN_TTL) return;
    } catch (e) {}
    GM_setValue('grl_autotoken', '');
  }

  function el(tag, css, text) {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }

  function createCardShell(id) {
    const old = document.getElementById(id);
    if (old) old.remove();

    const overlay = el(
      'div',
      'position:fixed;inset:0;z-index:100000;background:rgba(1,4,9,.6);' +
        'display:flex;align-items:center;justify-content:center;'
    );
    overlay.id = id;

    const card = el(
      'div',
      'width:min(480px,92vw);padding:20px;border-radius:12px;font-size:14px;' +
        'background:var(--overlay-bgColor,var(--bgColor-default,#0d1117));' +
        'color:var(--fgColor-default,#e6edf3);' +
        'border:1px solid var(--borderColor-default,#30363d);' +
        'box-shadow:0 8px 32px rgba(1,4,9,.5);'
    );

    overlay.appendChild(card);
    return { overlay, card };
  }

  function makeInput(placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.cssText =
      'width:100%;box-sizing:border-box;padding:6px 12px;border-radius:6px;font-size:14px;' +
      'background:var(--bgColor-inset,#010409);color:var(--fgColor-default,#e6edf3);' +
      'border:1px solid var(--borderColor-default,#30363d);';
    return input;
  }

  function makeButton(label, kind) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    const base = 'height:32px;padding:0 12px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;';
    if (kind === 'primary') {
      b.style.cssText =
        base +
        'background:var(--button-primary-bgColor-rest,#238636);color:var(--button-primary-fgColor-rest,#fff);' +
        'border:1px solid var(--borderColor-default,rgba(255,255,255,.1));';
    } else {
      b.style.cssText =
        base +
        'background:var(--button-default-bgColor-rest,#21262d);color:var(--fgColor-default,#e6edf3);' +
        'border:1px solid var(--borderColor-default,#30363d);';
    }
    return b;
  }

  async function validateAndStore(token) {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(res.status === 401 ? 'GitHub rejected that token.' : `GitHub API ${res.status}`);
    setStoredToken(token);
  }

  function showTokenCard() {
    return new Promise((resolve) => {
      let mode = 'auto';
      let poll = null;
      let startedAt = 0;
      let closedAt = 0;
      let autoTab = null;
      let input = null;
      let saveBtn = null;

      const { overlay, card } = createCardShell('grl-token-overlay');
      const msg = el('div', 'min-height:18px;margin-top:10px;font-size:12px;color:var(--fgColor-danger,#f85149);');

      const onKey = (e) => {
        if (mode === 'done') return;
        if (e.key === 'Escape') close(false);
        if (e.key === 'Enter' && mode === 'manual') save();
      };

      function stopPolling() {
        if (poll) clearInterval(poll);
        poll = null;
        onAutoToken = null;
      }

      function closeAutoTab() {
        try {
          if (autoTab && typeof autoTab.close === 'function') autoTab.close();
        } catch (e) {}
        autoTab = null;
      }

      function close(saved) {
        document.removeEventListener('keydown', onKey, true);
        stopPolling();
        GM_setValue('grl_autogen', 0);
        overlay.remove();
        resolve(saved);
      }

      function renderAuto() {
        mode = 'auto';
        card.innerHTML =
          '<div style="font-size:16px;font-weight:600;margin-bottom:8px;">Setting up your GitHub token</div>' +
          '<div style="display:flex;align-items:center;gap:12px;margin:14px 0;">' +
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--fgColor-accent,#4493f8)" ' +
          'stroke-width="3" stroke-linecap="round" style="flex:none;">' +
          '<circle cx="12" cy="12" r="9" stroke-opacity=".25"></circle><path d="M21 12a9 9 0 0 0-9-9"></path></svg>' +
          '<div style="color:var(--fgColor-muted,#8d96a0);">A new tab is generating your token and copying it. ' +
          'If GitHub asks for your password, enter it there. This card carries on by itself.</div></div>';
        const spin = card.querySelector('svg');
        if (typeof spin.animate === 'function') {
          spin.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
            duration: 900,
            iterations: Infinity,
          });
        }
        const row = el('div', 'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;');
        const cancelBtn = makeButton('Cancel');
        cancelBtn.addEventListener('click', () => close(false));
        row.append(cancelBtn);
        card.append(row);
      }

      function renderManual(reason) {
        mode = 'manual';
        stopPolling();
        GM_setValue('grl_autogen', 0);
        card.innerHTML =
          '<div style="font-size:16px;font-weight:600;margin-bottom:8px;">Paste your token</div>' +
          '<div style="margin-bottom:12px;color:var(--fgColor-muted,#8d96a0);"><span data-reason></span> ' +
          'Copy the token from <a href="' +
          TOKENS_LIST_URL +
          '" target="_blank" rel="noopener" style="color:var(--fgColor-accent,#4493f8);">github.com/settings/tokens</a> ' +
          '(GitHub only shows it once, right after it is generated) and paste it below. ' +
          'Not there anymore? <a href="' +
          TOKEN_URL +
          '" target="_blank" rel="noopener" style="color:var(--fgColor-accent,#4493f8);">Generate a new one</a>.</div>';
        card.querySelector('[data-reason]').textContent = 'Automatic setup could not finish. ' + reason;

        input = makeInput('ghp_... or github_pat_...');
        input.type = 'password';
        msg.textContent = '';

        const row = el('div', 'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;');
        const cancelBtn = makeButton('Cancel');
        saveBtn = makeButton('Save token', 'primary');
        cancelBtn.addEventListener('click', () => close(false));
        saveBtn.addEventListener('click', () => save());
        row.append(cancelBtn, saveBtn);

        card.append(input, msg, row);
        input.focus();
      }

      function showDone() {
        mode = 'done';
        card.innerHTML =
          '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 0 8px;">' +
          '<svg width="72" height="72" viewBox="0 0 52 52" fill="none" stroke="var(--fgColor-success,#3fb950)" ' +
          'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="26" cy="26" r="23" stroke-dasharray="145" stroke-dashoffset="145"></circle>' +
          '<path d="M15 27l8 8 14-16" stroke-dasharray="40" stroke-dashoffset="40"></path>' +
          '</svg>' +
          '<div style="font-size:18px;font-weight:600;">Done</div>' +
          '</div>';
        const circle = card.querySelector('circle');
        const check = card.querySelector('path');
        if (typeof circle.animate === 'function') {
          circle.animate([{ strokeDashoffset: 145 }, { strokeDashoffset: 0 }], {
            duration: 500,
            easing: 'ease-out',
            fill: 'forwards',
          });
          check.animate([{ strokeDashoffset: 40 }, { strokeDashoffset: 0 }], {
            duration: 350,
            delay: 450,
            easing: 'ease-out',
            fill: 'forwards',
          });
          card.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
        } else {
          circle.setAttribute('stroke-dashoffset', '0');
          check.setAttribute('stroke-dashoffset', '0');
        }
        setTimeout(() => close(true), 1400);
      }

      function startAuto() {
        startedAt = Date.now();
        GM_setValue('grl_autotoken', '');
        GM_setValue('grl_autofail', 0);
        GM_setValue('grl_autogen', startedAt);
        GM_setValue('grl_autogen_click', 0);

        let opened = false;
        try {
          autoTab = window.open(TOKEN_URL, '_blank');
          opened = !!autoTab;
        } catch (e) {}
        if (!opened && typeof GM_openInTab === 'function') {
          try {
            autoTab = GM_openInTab(TOKEN_URL, { active: true }) || null;
            opened = true;
          } catch (e) {}
        }
        if (!opened) {
          renderManual('The token tab could not be opened.');
          return;
        }

        onAutoToken = checkAuto;
        poll = setInterval(checkAuto, 500);
      }

      function checkAuto() {
        if (mode !== 'auto') return;

        const raw = GM_getValue('grl_autotoken', '');
        let data = null;
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (e) {}
        }
        if (data && data.token) {
          GM_setValue('grl_autotoken', '');
          stopPolling();
          closeAutoTab();
          adopt(data.token);
          return;
        }

        if (Number(GM_getValue('grl_autofail', 0))) {
          renderManual('The token page could not be read.');
          return;
        }
        if (Date.now() - startedAt > AUTO_TIMEOUT) {
          renderManual('Timed out waiting for the token.');
          return;
        }
        if (autoTab && autoTab.closed === true) {
          if (!closedAt) closedAt = Date.now();
          else if (Date.now() - closedAt > 3000) renderManual('The token tab was closed before the token was captured.');
        }
      }

      async function adopt(token) {
        try {
          await validateAndStore(token);
          showDone();
        } catch (e) {
          renderManual(`The generated token could not be verified (${e.message}).`);
        }
      }

      async function save() {
        if (mode !== 'manual') return;
        const t = input.value.trim();
        if (!t) {
          msg.textContent = 'Paste a token first.';
          return;
        }
        saveBtn.disabled = true;
        saveBtn.textContent = 'Checking...';
        msg.textContent = '';
        try {
          await validateAndStore(t);
          showDone();
        } catch (e) {
          msg.textContent = e.message;
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save token';
        }
      }

      renderAuto();
      document.body.appendChild(overlay);
      document.addEventListener('keydown', onKey, true);
      overlay.addEventListener('mousedown', (e) => {
        if (mode !== 'done' && e.target === overlay) close(false);
      });
      startAuto();
    });
  }

  function autogenPending() {
    const t = Number(GM_getValue('grl_autogen', 0));
    return t > 0 && Date.now() - t < AUTOGEN_TTL;
  }

  function showPageNote(text) {
    const n = el(
      'div',
      'position:fixed;bottom:20px;right:20px;z-index:100000;max-width:340px;padding:10px 14px;border-radius:8px;font-size:14px;' +
        'background:var(--bgColor-default,#0d1117);color:var(--fgColor-default,#e6edf3);' +
        'border:1px solid var(--borderColor-default,#30363d);box-shadow:0 8px 24px rgba(1,4,9,.5);',
      text
    );
    document.body.appendChild(n);
  }

  function signalFail(note) {
    if (!autogenPending()) return;
    GM_setValue('grl_autofail', Date.now());
    showPageNote(note);
  }

  function handleTokenNewPage() {
    const params = new URLSearchParams(location.search);
    if (params.get('description') !== TOKEN_DESCRIPTION) return;
    let tries = 0;
    const timer = setInterval(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /generate token/i.test(b.textContent));
      if (!btn) {
        if (++tries > 40) {
          clearInterval(timer);
          signalFail('Could not find the Generate token button. Create the token here, then paste it into the card in your repo tab.');
        }
        return;
      }
      clearInterval(timer);
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!autogenPending()) return;
      const last = Number(GM_getValue('grl_autogen_click', 0));
      if (Date.now() - last < 10000) return;
      GM_setValue('grl_autogen_click', Date.now());
      setTimeout(() => btn.click(), 1200);
    }, 250);
  }

  function handleTokensListPage() {
    if (!autogenPending()) return;
    const clicked = Number(GM_getValue('grl_autogen_click', 0));
    if (!clicked || Date.now() - clicked > AUTOGEN_TTL) return;
    let tries = 0;
    const timer = setInterval(() => {
      const node = document.getElementById('new-oauth-token');
      let token = node && node.textContent.trim();
      if (!token) {
        const m = document.body.innerText.match(TOKEN_RE);
        token = m && m[1];
      }
      if (token) {
        clearInterval(timer);
        GM_setClipboard(token);
        GM_setValue('grl_autotoken', JSON.stringify({ token, ts: Date.now() }));
        GM_setValue('grl_autogen', 0);
        showPageNote('Token copied and sent to your repo tab. Closing this tab...');
        setTimeout(() => window.close(), 700);
      } else if (++tries > 60) {
        clearInterval(timer);
        signalFail('Could not read the token automatically. Copy it from this page and paste it into the card in your repo tab.');
      }
    }, 250);
  }

  function routeTokenPages() {
    const p = location.pathname.replace(/\/+$/, '');
    if (p === '/settings/tokens/new') handleTokenNewPage();
    else if (p === '/settings/tokens') handleTokensListPage();
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Set GitHub token (Copy Raw Links)', () => showTokenCard());
    GM_registerMenuCommand('Clear GitHub token (Copy Raw Links)', () => {
      clearStoredToken();
      alert('GitHub API token cleared.');
    });
  }

  let tokenPrompted = false;
  let grlLastPath = '';
  function grlRouteTick() {
    if (location.pathname !== grlLastPath) {
      grlLastPath = location.pathname;
      routeTokenPages();
    }
  }
  new MutationObserver(grlRouteTick).observe(document.documentElement, { childList: true, subtree: true });
  grlRouteTick();

  async function ghGet(url) {
    let res = await fetch(url, { headers: apiHeaders() });
    if (res.status === 401 && getStoredToken()) {
      clearStoredToken();
      res = await fetch(url, { headers: apiHeaders() });
    }
    if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const when = reset ? new Date(reset * 1000).toLocaleTimeString() : 'later';
      if (!getStoredToken() && confirm(`GitHub API rate limit hit (resets at ${when}).\n\nSet up a token now to raise the limit to 5000/hr?`)) {
        const saved = await showTokenCard();
        if (saved) return ghGet(url);
      }
      throw new Error(`GitHub API rate limit hit. Resets at ${when}. Use the userscript menu → "Set GitHub token (Copy Raw Links)" to raise the limit to 5000/hr.`);
    }
    return res;
  }

  const treeCache = new Map();
  const CACHE_TTL_MS = 10 * 60 * 1000;

  function cacheKey(owner, repo, branch) {
    return `${owner}/${repo}@${branch}`;
  }

  function copyText(text) {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, 'text');
      return Promise.resolve();
    }
    return navigator.clipboard.writeText(text);
  }

  function flashCopied(btn, label) {
    const original = btn.textContent;
    btn.textContent = label || 'Copied!';
    btn.classList.add('grl-copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('grl-copied');
    }, 1200);
  }

  function toRawUrl(href) {
    try {
      const url = new URL(href, location.origin);
      if (url.hostname !== 'github.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      const kindIdx = parts.findIndex((p) => p === 'blob' || p === 'raw');
      if (kindIdx === -1 || kindIdx < 2) return null;
      const owner = parts[0];
      const repo = parts[1];
      const branch = parts[kindIdx + 1];
      const filePath = parts.slice(kindIdx + 2).join('/');
      if (!owner || !repo || !branch || !filePath) return null;
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    } catch (e) {
      return null;
    }
  }

  function collectFolderRawLinks() {
    const anchors = document.querySelectorAll(
      'a[href*="/blob/"]:not([data-grl-ignore])'
    );
    const seen = new Set();
    const raws = [];
    anchors.forEach((a) => {
      if (a.closest('nav, header, [role="navigation"]')) return;
      const raw = toRawUrl(a.getAttribute('href'));
      if (raw && !seen.has(raw)) {
        seen.add(raw);
        raws.push(raw);
      }
    });
    return raws;
  }

  function getRepoRootContext() {
    const parts = location.pathname.split('/').filter(Boolean);
    const owner = parts[0];
    const repo = parts[1];
    const treeIdx = parts.indexOf('tree');
    if (treeIdx !== -1 && parts[treeIdx - 1] === repo) {
      const branch = parts[treeIdx + 1];
      const basePath = parts.slice(treeIdx + 2).join('/');
      return { owner, repo, branch, basePath };
    }
    return { owner, repo, branch: null, basePath: '' };
  }

  async function resolveDefaultBranch(owner, repo) {
    const res = await ghGet(`https://api.github.com/repos/${owner}/${repo}`);
    if (!res.ok) throw new Error(`Repo lookup failed (${res.status})`);
    const data = await res.json();
    return data.default_branch;
  }

  async function fetchAllRawLinksRecursive() {
    const { owner, repo, basePath } = getRepoRootContext();
    let { branch } = getRepoRootContext();
    if (!branch) branch = await resolveDefaultBranch(owner, repo);

    const key = cacheKey(owner, repo, branch);
    const cached = treeCache.get(key);
    let tree;
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
      tree = cached.tree;
    } else {
      const res = await ghGet(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
      );
      if (!res.ok) throw new Error(`Tree fetch failed (${res.status})`);
      const data = await res.json();
      if (data.truncated) {
        console.warn('[GitHub Copy Raw Links] Tree result truncated by GitHub API; some files may be missing.');
      }
      tree = data.tree;
      treeCache.set(key, { time: Date.now(), tree });
    }

    let files = tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path);
    if (basePath) {
      files = files.filter((p) => p === basePath || p.startsWith(basePath + '/'));
    }
    return files.map(
      (p) => `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${p}`
    );
  }

  function isSingleFileView() {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts[2] === 'blob';
  }

  function injectSingleFileButton() {
    if (document.querySelector('.grl-single-btn')) return;
    const toolbar =
      document.querySelector('#StickyHeader div[class*="Box-sc"] div:last-child') ||
      document.querySelector('[data-testid="raw-button"]')?.parentElement ||
      document.querySelector('.react-blob-header-edit-and-raw-actions') ||
      document.querySelector('#repos-sticky-header') ||
      document.querySelector('.file-header .file-actions') ||
      document.querySelector('.Box-header');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grl-btn grl-single-btn';
    btn.textContent = 'Copy raw link';
    btn.addEventListener('click', () => {
      const raw = toRawUrl(location.href);
      if (!raw) return;
      copyText(raw).then(() => flashCopied(btn));
    });

    if (toolbar) {
      toolbar.appendChild(btn);
    } else {
      btn.style.position = 'fixed';
      btn.style.bottom = '16px';
      btn.style.right = '16px';
      btn.style.zIndex = 9999;
      document.body.appendChild(btn);
    }
  }

  function injectFolderButton() {
    if (document.querySelector('.grl-folder-btn')) return;
    if (collectFolderRawLinks().length === 0) return;

    const anchor =
      document.querySelector('#folders-and-files + div') ||
      document.querySelector('[data-testid="folder-row"]')?.closest('div[role="grid"]')?.previousElementSibling ||
      document.querySelector('.file-navigation') ||
      document.querySelector('h2[data-testid="latest-commit-details"]')?.parentElement;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grl-btn grl-folder-btn';
    btn.textContent = 'Copy all raw links (incl. subfolders)';
    btn.addEventListener('click', async () => {
      if (!getStoredToken() && !tokenPrompted) {
        tokenPrompted = true;
        await showTokenCard();
      }
      const original = btn.textContent;
      btn.textContent = 'Fetching file list…';
      btn.disabled = true;
      try {
        const raws = await fetchAllRawLinksRecursive();
        if (raws.length === 0) {
          btn.textContent = 'No files found';
          setTimeout(() => (btn.textContent = original), 1500);
        } else {
          await copyText(raws.join('\n'));
          flashCopied(btn, `Copied ${raws.length}!`);
        }
      } catch (err) {
        console.error('[GitHub Copy Raw Links]', err);
        alert(`Copy raw links failed:\n\n${err.message}`);
        btn.textContent = original;
      } finally {
        btn.disabled = false;
      }
    });

    if (anchor) {
      anchor.style.display = anchor.style.display || 'flex';
      anchor.appendChild(btn);
    } else {
      btn.style.position = 'fixed';
      btn.style.bottom = '16px';
      btn.style.right = '16px';
      btn.style.zIndex = 9999;
      document.body.appendChild(btn);
    }

    injectPerRowButtons();
  }

  function injectPerRowButtons() {
    const anchors = document.querySelectorAll(
      'a[href*="/blob/"]:not([data-grl-row-done])'
    );
    anchors.forEach((a) => {
      if (a.closest('nav, header, [role="navigation"]')) return;
      const raw = toRawUrl(a.getAttribute('href'));
      if (!raw) return;
      a.setAttribute('data-grl-row-done', '1');

      const row = a.closest('[role="row"]') || a.parentElement;
      if (!row || row.querySelector('.grl-row-btn')) return;

      const span = document.createElement('span');
      span.className = 'grl-row-btn';
      span.textContent = '⧉ raw';
      span.title = 'Copy raw.githubusercontent.com link';
      span.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyText(raw).then(() => {
          const original = span.textContent;
          span.textContent = 'copied!';
          setTimeout(() => (span.textContent = original), 1000);
        });
      });
      a.insertAdjacentElement('afterend', span);
    });
  }

  function run() {
    if (isSingleFileView()) {
      injectSingleFileButton();
    } else {
      injectFolderButton();
    }
  }

  run();

  document.addEventListener('turbo:load', run);
  document.addEventListener('turbo:render', run);
  document.addEventListener('pjax:end', run);

  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
