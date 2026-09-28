// ==UserScript==
// @name         GitHub Last Commit Wiper
// @namespace    https://github.com/ItzMeShadow999
// @version      1.3.3
// @description  Adds a "Wipe Commits" button. Enter a commit SHA (or leave blank for the latest) and remove only that commit while keeping the newer ones, wipe it and everything after it, or keep it and wipe only the newer commits. The latest commit can also be reverted.
// @author       ItzMeShadow999
// @homepageURL  https://github.com/ItzMeShadow999/Github-QOL
// @supportURL   https://github.com/ItzMeShadow999/Github-QOL/issues
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/GitHub_Last_Commit_Wiper.user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/GitHub_Last_Commit_Wiper.user.js
// @match        https://github.com/*/*
// @icon         https://i.ibb.co/XxSnS9h9/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const API = 'https://api.github.com';
  const BTN_ID = 'gh-lcw-btn';
  const OVERLAY_ID = 'gh-lcw-overlay';
  const TOKEN_DESCRIPTION = 'Last Commit Wiper UserScript';
  const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Last%20Commit%20Wiper%20UserScript';
  const TOKENS_LIST_URL = 'https://github.com/settings/tokens';
  const AUTOGEN_TTL = 5 * 60 * 1000;
  const AUTO_TIMEOUT = 2 * 60 * 1000;
  const TOKEN_RE = /\b(ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/;
  const RESERVED = new Set([
    'settings', 'notifications', 'orgs', 'marketplace', 'explore', 'topics', 'trending',
    'sponsors', 'login', 'join', 'new', 'pulls', 'issues', 'codespaces', 'features',
    'about', 'pricing', 'search', 'collections', 'events', 'account', 'organizations',
    'apps', 'enterprise', 'users', 'stars', 'watching', 'dashboard', 'readme', 'security',
  ]);
  const SKIP_TABS = ['settings', 'issues', 'pulls', 'actions', 'projects', 'wiki', 'security', 'pulse', 'graphs', 'network'];

  let onAutoToken = null;
  let lastScopes = null;

  GM_registerMenuCommand('Wipe Commits', () => {
    const ctx = getContext();
    if (ctx) handleWipeClick(ctx);
    else alert('Open a repository page first.');
  });
  GM_registerMenuCommand('Set GitHub Token (Last Commit Wiper)', () => showTokenCard());

  if (typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener('gh_lcw_autotoken', () => {
      if (onAutoToken) onAutoToken();
    });
  }

  clearStaleAutoToken();

  function clearStaleAutoToken() {
    const raw = GM_getValue('gh_lcw_autotoken', '');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (Date.now() - data.ts < AUTOGEN_TTL) return;
    } catch (e) {}
    GM_setValue('gh_lcw_autotoken', '');
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

    const overlay = el('div',
      'position:fixed;inset:0;z-index:100000;background:rgba(1,4,9,.6);' +
      'display:flex;align-items:center;justify-content:center;');
    overlay.id = id;

    const card = el('div',
      'width:min(480px,92vw);padding:20px;border-radius:12px;font-size:14px;' +
      'background:var(--overlay-bgColor,var(--bgColor-default,#0d1117));' +
      'color:var(--fgColor-default,#e6edf3);' +
      'border:1px solid var(--borderColor-default,#30363d);' +
      'box-shadow:0 8px 32px rgba(1,4,9,.5);');

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
      b.style.cssText = base +
        'background:var(--button-primary-bgColor-rest,#238636);color:var(--button-primary-fgColor-rest,#fff);' +
        'border:1px solid var(--borderColor-default,rgba(255,255,255,.1));';
    } else if (kind === 'danger') {
      b.style.cssText = base +
        'background:var(--button-danger-bgColor-rest,#da3633);color:var(--button-danger-fgColor-rest,#fff);' +
        'border:1px solid var(--button-danger-borderColor-rest,rgba(255,255,255,.1));';
    } else {
      b.style.cssText = base +
        'background:var(--button-default-bgColor-rest,#21262d);color:var(--fgColor-default,#e6edf3);' +
        'border:1px solid var(--borderColor-default,#30363d);';
    }
    return b;
  }

  function getToken() {
    return GM_getValue('gh_lcw_token', null);
  }

  function canWrite(scopes) {
    return scopes === null || /(^|,\s*)(repo|public_repo)(\s*,|$)/.test(scopes);
  }

  function scopeMessage(scopes) {
    return `This token's scopes (${scopes || 'none'}) cannot write to repos. Use "Set GitHub Token" from the userscript menu to make one with the repo scope.`;
  }

  async function validateAndStore(token) {
    const res = await fetch(`${API}/user`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(res.status === 401 ? 'GitHub rejected that token.' : `GitHub API ${res.status}`);
    const scopes = res.headers.get('x-oauth-scopes');
    if (!canWrite(scopes)) throw new Error(scopeMessage(scopes));
    GM_setValue('gh_lcw_token', token);
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

      const { overlay, card } = createCardShell('gh-lcw-token-overlay');

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
        GM_setValue('gh_lcw_autogen', 0);
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
          spin.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
            { duration: 900, iterations: Infinity });
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
        GM_setValue('gh_lcw_autogen', 0);
        card.innerHTML =
          '<div style="font-size:16px;font-weight:600;margin-bottom:8px;">Paste your token</div>' +
          '<div style="margin-bottom:12px;color:var(--fgColor-muted,#8d96a0);"><span data-reason></span> ' +
          'Copy the token from <a href="' + TOKENS_LIST_URL + '" target="_blank" rel="noopener" ' +
          'style="color:var(--fgColor-accent,#4493f8);">github.com/settings/tokens</a> ' +
          '(GitHub only shows it once, right after it is generated) and paste it below. ' +
          'Not there anymore? <a href="' + TOKEN_URL + '" target="_blank" rel="noopener" ' +
          'style="color:var(--fgColor-accent,#4493f8);">Generate a new one</a>.</div>';
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
          circle.animate([{ strokeDashoffset: 145 }, { strokeDashoffset: 0 }],
            { duration: 500, easing: 'ease-out', fill: 'forwards' });
          check.animate([{ strokeDashoffset: 40 }, { strokeDashoffset: 0 }],
            { duration: 350, delay: 450, easing: 'ease-out', fill: 'forwards' });
          card.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1)' }],
            { duration: 200, easing: 'ease-out' });
        } else {
          circle.setAttribute('stroke-dashoffset', '0');
          check.setAttribute('stroke-dashoffset', '0');
        }
        setTimeout(() => close(true), 1400);
      }

      function startAuto() {
        startedAt = Date.now();
        GM_setValue('gh_lcw_autotoken', '');
        GM_setValue('gh_lcw_autofail', 0);
        GM_setValue('gh_lcw_autogen', startedAt);
        GM_setValue('gh_lcw_autogen_click', 0);

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

        const raw = GM_getValue('gh_lcw_autotoken', '');
        let data = null;
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (e) {}
        }
        if (data && data.token) {
          GM_setValue('gh_lcw_autotoken', '');
          stopPolling();
          closeAutoTab();
          adopt(data.token);
          return;
        }

        if (Number(GM_getValue('gh_lcw_autofail', 0))) {
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
    const t = Number(GM_getValue('gh_lcw_autogen', 0));
    return t > 0 && Date.now() - t < AUTOGEN_TTL;
  }

  function showPageNote(text) {
    const n = el('div',
      'position:fixed;bottom:20px;right:20px;z-index:100000;max-width:340px;padding:10px 14px;border-radius:8px;font-size:14px;' +
      'background:var(--bgColor-default,#0d1117);color:var(--fgColor-default,#e6edf3);' +
      'border:1px solid var(--borderColor-default,#30363d);box-shadow:0 8px 24px rgba(1,4,9,.5);',
      text);
    document.body.appendChild(n);
  }

  function signalFail(note) {
    if (!autogenPending()) return;
    GM_setValue('gh_lcw_autofail', Date.now());
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
      const last = Number(GM_getValue('gh_lcw_autogen_click', 0));
      if (Date.now() - last < 10000) return;
      GM_setValue('gh_lcw_autogen_click', Date.now());
      setTimeout(() => btn.click(), 1200);
    }, 250);
  }

  function handleTokensListPage() {
    if (!autogenPending()) return;
    const clicked = Number(GM_getValue('gh_lcw_autogen_click', 0));
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
        GM_setValue('gh_lcw_autotoken', JSON.stringify({ token, ts: Date.now() }));
        GM_setValue('gh_lcw_autogen', 0);
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

  function getContext() {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length < 2 || RESERVED.has(parts[0].toLowerCase())) return null;
    if (SKIP_TABS.includes(parts[2])) return null;
    const rest = ['tree', 'commits', 'blob'].includes(parts[2]) ? parts.slice(3).map(decodeURIComponent) : [];
    return { owner: parts[0], repo: parts[1], rest };
  }

  async function ghFetch(method, path, body) {
    const token = getToken();
    if (!token) throw new Error('No token set.');
    const res = await fetch(API + path, {
      method,
      headers: Object.assign(
        {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body ? { 'Content-Type': 'application/json' } : {}
      ),
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('x-oauth-scopes');
    if (sc !== null) lastScopes = sc;
    if (res.status === 401) {
      GM_setValue('gh_lcw_token', '');
      const err = new Error('GitHub rejected the saved token. Click Wipe Commits again to set up a new one.');
      err.status = 401;
      throw err;
    }
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const where = `${method} ${path.split('?')[0]}`;
      const err = new Error(
        res.status === 404
          ? `Not Found at ${where}. The token may not have access to this repo, or that commit, branch or object does not exist here.` +
            (method !== 'GET' && lastScopes !== null ? ` Token scopes: ${lastScopes || 'none'}.` : '')
          : `${(data && data.message) || `GitHub API ${res.status}`} (${where})`
      );
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function friendly(e) {
    if (e.status === 403 || e.status === 422) {
      return `${e.message} (protected branches and rulesets can block force pushes)`;
    }
    return e.message;
  }

  function firstLine(msg) {
    return String(msg || '').split('\n')[0];
  }

  function short(sha) {
    return String(sha).slice(0, 7);
  }

  function title(text) {
    return el('div', 'font-size:16px;font-weight:600;margin-bottom:10px;', text);
  }

  function muted(text) {
    return el('div', 'color:var(--fgColor-muted,#8d96a0);margin-bottom:6px;word-break:break-word;', text);
  }

  function btnRow(...btns) {
    const r = el('div', 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap;');
    btns.forEach((b) => r.appendChild(b));
    return r;
  }

  function openCard() {
    const { overlay, card } = createCardShell(OVERLAY_ID);
    document.body.appendChild(overlay);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
    };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    return { card, close };
  }

  async function resolveBranch(ctx, defaultBranch) {
    for (let i = 1; i <= Math.min(ctx.rest.length, 5); i++) {
      const name = ctx.rest.slice(0, i).join('/');
      try {
        const ref = await ghFetch('GET', `/repos/${ctx.owner}/${ctx.repo}/git/ref/heads/${encodeURI(name)}`);
        if (ref && ref.object) return name;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
    }
    return defaultBranch;
  }

  async function handleWipeClick(ctx) {
    if (!getToken()) {
      const saved = await showTokenCard();
      if (!saved) return;
    }

    const { card, close } = openCard();
    card.appendChild(title('Wipe commits'));
    card.appendChild(muted('Loading branch info...'));

    try {
      const base = `/repos/${ctx.owner}/${ctx.repo}`;
      const repo = await ghFetch('GET', base);
      if (repo.permissions && !repo.permissions.push) {
        throw new Error('Your token has no write access to this repo.');
      }
      if (!canWrite(lastScopes)) throw new Error(scopeMessage(lastScopes));
      const branch = await resolveBranch(ctx, repo.default_branch);
      const ref = await ghFetch('GET', `${base}/git/ref/heads/${encodeURI(branch)}`);
      const head = await ghFetch('GET', `${base}/git/commits/${ref.object.sha}`);
      renderPick({ base, branch, head, repo, card, close });
    } catch (e) {
      renderError(card, close, e.message);
    }
  }

  function renderError(card, close, message) {
    card.textContent = '';
    card.appendChild(title('Could not continue'));
    card.appendChild(el('div', 'color:var(--fgColor-danger,#f85149);word-break:break-word;', message));
    const closeBtn = makeButton('Close');
    closeBtn.addEventListener('click', close);
    card.appendChild(btnRow(closeBtn));
  }

  function renderPick(s) {
    const { card, close, head, branch } = s;
    card.textContent = '';
    card.appendChild(title('Wipe commits'));
    card.appendChild(muted(`${s.repo.full_name} \u25B8 ${branch}`));
    card.appendChild(muted(`Latest: ${short(head.sha)} ${firstLine(head.message)}`));
    card.appendChild(el('div', 'font-size:12px;margin:10px 0 6px;',
      'Commit SHA to wipe (full or short). Leave blank to target the latest commit.'));

    const input = makeInput('9c1db7613acec576706d20ee838ad87cdf9f7d5a');
    card.appendChild(input);

    const msg = el('div', 'min-height:18px;margin-top:10px;font-size:12px;color:var(--fgColor-danger,#f85149);word-break:break-word;');
    card.appendChild(msg);

    const cancel = makeButton('Cancel');
    const next = makeButton('Next', 'primary');
    card.appendChild(btnRow(cancel, next));
    cancel.addEventListener('click', close);

    async function go() {
      const sha = input.value.trim();
      if (sha && !/^[0-9a-f]{7,40}$/i.test(sha)) {
        msg.textContent = 'Enter a 7 to 40 character hex commit SHA.';
        return;
      }
      next.disabled = true;
      input.disabled = true;
      next.textContent = 'Checking...';
      msg.textContent = '';
      try {
        let target = head;
        if (sha) {
          let c;
          try {
            c = await ghFetch('GET', `${s.base}/commits/${sha}`);
          } catch (e) {
            if (e.status === 404 || e.status === 422) {
              throw new Error(`No commit ${sha} found in ${s.repo.full_name}. Check the SHA belongs to this repository.`);
            }
            throw e;
          }
          target = {
            sha: c.sha,
            message: c.commit.message,
            tree: { sha: c.commit.tree.sha },
            parents: c.parents,
          };
        }
        const cmp = await ghFetch('GET', `${s.base}/compare/${target.sha}...${head.sha}`);
        if (cmp.status !== 'ahead' && cmp.status !== 'identical') {
          throw new Error(`${short(target.sha)} is not in the history of ${branch}.`);
        }
        const ahead = cmp.ahead_by;
        const parent = target.parents.length
          ? await ghFetch('GET', `${s.base}/git/commits/${target.parents[0].sha}`)
          : null;
        if (!parent && !ahead) {
          throw new Error('This is the initial commit and the branch tip. There is nothing to reset to.');
        }
        renderConfirm(Object.assign({}, s, { target, parent, ahead }));
      } catch (e) {
        next.disabled = false;
        input.disabled = false;
        next.textContent = 'Next';
        msg.textContent = e.message;
      }
    }

    next.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    setTimeout(() => input.focus(), 0);
  }

  const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  const MAX_REWRITE = 100;

  function sameEntry(a, b) {
    if (!a || !b) return !a && !b;
    return a.sha === b.sha && a.mode === b.mode;
  }

  function sameLines(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function lcsMap(x, y) {
    const m = new Map();
    let s = 0;
    while (s < x.length && s < y.length && x[s] === y[s]) {
      m.set(s, s);
      s++;
    }
    let ex = x.length;
    let ey = y.length;
    const tail = [];
    while (ex > s && ey > s && x[ex - 1] === y[ey - 1]) {
      ex--;
      ey--;
      tail.push([ex, ey]);
    }
    const n = ex - s;
    const k = ey - s;
    if (n && k) {
      if (n * k > 6e6) throw new Error('file too large to merge automatically');
      const w = k + 1;
      const dp = new Uint32Array((n + 1) * w);
      for (let i = n - 1; i >= 0; i--) {
        for (let j = k - 1; j >= 0; j--) {
          dp[i * w + j] = x[s + i] === y[s + j]
            ? dp[(i + 1) * w + j + 1] + 1
            : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
        }
      }
      let i = 0;
      let j = 0;
      while (i < n && j < k) {
        if (x[s + i] === y[s + j]) {
          m.set(s + i, s + j);
          i++;
          j++;
        } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
        else j++;
      }
    }
    tail.forEach(([i, j]) => m.set(i, j));
    return m;
  }

  function merge3(base, a, b) {
    const ma = lcsMap(base, a);
    const mb = lcsMap(base, b);
    const stable = [];
    for (let i = 0; i < base.length; i++) if (ma.has(i) && mb.has(i)) stable.push(i);
    stable.push(base.length);
    const out = [];
    let bi = 0;
    let ai = 0;
    let bj = 0;
    for (const i of stable) {
      const last = i === base.length;
      const aEnd = last ? a.length : ma.get(i);
      const bEnd = last ? b.length : mb.get(i);
      const bc = base.slice(bi, i);
      const ac = a.slice(ai, aEnd);
      const cc = b.slice(bj, bEnd);
      if (sameLines(ac, bc)) out.push(...cc);
      else if (sameLines(cc, bc) || sameLines(ac, cc)) out.push(...ac);
      else return null;
      if (!last) out.push(base[i]);
      bi = i + 1;
      ai = aEnd + 1;
      bj = bEnd + 1;
    }
    return out;
  }

  async function loadTree(base, sha) {
    const map = new Map();
    if (!sha || sha === EMPTY_TREE_SHA) return map;
    const t = await ghFetch('GET', `${base}/git/trees/${sha}?recursive=1`);
    if (t.truncated) throw new Error('The repository tree is too large to rewrite through the API.');
    t.tree.forEach((n) => {
      if (n.type !== 'tree') map.set(n.path, { mode: n.mode, type: n.type, sha: n.sha });
    });
    return map;
  }

  async function readBlob(base, sha) {
    const b = await ghFetch('GET', `${base}/git/blobs/${sha}`);
    return atob(b.content.replace(/\s/g, ''));
  }

  async function mergeFile(base, path, p, t, o, sha) {
    const fail = (why) => {
      throw new Error(`Conflict in ${path} at ${short(sha)}: ${why}. Nothing was changed.`);
    };
    if (!p || !t || !o) fail('the file was added, deleted or renamed on one side');
    if (p.type !== 'blob' || t.type !== 'blob' || o.type !== 'blob') fail('not a regular file');
    const [bs, ts, os] = await Promise.all([
      readBlob(base, p.sha), readBlob(base, t.sha), readBlob(base, o.sha),
    ]);
    if ([bs, ts, os].some((x) => x.indexOf('\0') !== -1)) fail('binary file edited on both sides');
    let merged = null;
    try {
      merged = merge3(bs.split('\n'), ts.split('\n'), os.split('\n'));
    } catch (e) {
      fail(e.message);
    }
    if (!merged) fail('overlapping edits');
    const blob = await ghFetch('POST', `${base}/git/blobs`, {
      content: btoa(merged.join('\n')),
      encoding: 'base64',
    });
    return { mode: o.mode !== p.mode ? o.mode : t.mode, type: 'blob', sha: blob.sha };
  }

  async function makeTree(base, tipTree, entries, next) {
    if (tipTree && tipTree !== EMPTY_TREE_SHA) {
      try {
        return (await ghFetch('POST', `${base}/git/trees`, { base_tree: tipTree, tree: entries })).sha;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
    }
    const full = [...next].map(([path, v]) => ({ path, mode: v.mode, type: v.type, sha: v.sha }));
    if (!full.length) return EMPTY_TREE_SHA;
    return (await ghFetch('POST', `${base}/git/trees`, { tree: full })).sha;
  }

  async function rewriteWithout(s, progress) {
    const { base, head, target, parent } = s;
    const cmp = await ghFetch('GET', `${base}/compare/${target.sha}...${head.sha}?per_page=100`);
    const chain = cmp.commits;
    if (cmp.ahead_by > MAX_REWRITE || chain.length !== cmp.ahead_by) {
      throw new Error(`Too many newer commits to rewrite (limit ${MAX_REWRITE}).`);
    }
    let prev = target.sha;
    for (const c of chain) {
      if (c.parents.length !== 1 || c.parents[0].sha !== prev) {
        throw new Error('History after this commit is not a straight line (merge commits found), so it cannot be rewritten safely.');
      }
      prev = c.sha;
    }

    let tip = parent ? parent.sha : null;
    let tipTree = parent ? parent.tree.sha : null;
    let cur = await loadTree(base, tipTree);
    let origPrev = await loadTree(base, target.tree.sha);

    for (let n = 0; n < chain.length; n++) {
      const c = chain[n];
      progress(`Rewriting ${n + 1}/${chain.length} (${short(c.sha)})...`);
      const full = await ghFetch('GET', `${base}/git/commits/${c.sha}`);
      const origCur = await loadTree(base, full.tree.sha);
      const paths = new Set([...origPrev.keys(), ...origCur.keys()]);
      const entries = [];
      const next = new Map(cur);

      for (const path of paths) {
        const p = origPrev.get(path);
        const o = origCur.get(path);
        const t = cur.get(path);
        if (sameEntry(p, o) || sameEntry(t, o)) continue;
        const result = sameEntry(t, p) ? o : await mergeFile(base, path, p, t, o, c.sha);
        if (result) {
          entries.push({ path, mode: result.mode, type: result.type, sha: result.sha });
          next.set(path, result);
        } else {
          entries.push({ path, mode: t.mode, type: t.type, sha: null });
          next.delete(path);
        }
      }

      let treeSha = tipTree || EMPTY_TREE_SHA;
      if (entries.length) treeSha = await makeTree(base, tipTree, entries, next);
      const created = await ghFetch('POST', `${base}/git/commits`, {
        message: full.message,
        tree: treeSha,
        parents: tip ? [tip] : [],
        author: full.author,
        committer: full.committer,
      });
      tip = created.sha;
      tipTree = treeSha;
      cur = next;
      origPrev = origCur;
    }
    return tip;
  }

  function renderConfirm(s) {
    const { card, close, head, target, parent, branch, ahead } = s;
    const isHead = target.sha === head.sha;
    card.textContent = '';
    card.appendChild(title('Wipe commits'));
    card.appendChild(muted(`${s.repo.full_name} \u25B8 ${branch}`));

    const box = el('div',
      'margin:10px 0;padding:10px 12px;border-radius:8px;' +
      'background:var(--bgColor-inset,#010409);border:1px solid var(--borderColor-default,#30363d);');
    box.appendChild(el('div', 'font-weight:600;margin-bottom:4px;', `\u25AA Target ${short(target.sha)}`));
    box.appendChild(muted(firstLine(target.message)));
    box.appendChild(el('div', 'font-weight:600;margin:8px 0 4px;',
      `\u25AA ${ahead} newer commit${ahead === 1 ? '' : 's'} after it`));
    if (parent) {
      box.appendChild(el('div', 'font-weight:600;margin:8px 0 4px;', `\u25AA Parent ${short(parent.sha)}`));
      box.appendChild(muted(firstLine(parent.message)));
    }
    card.appendChild(box);

    if (target.parents.length > 1) {
      card.appendChild(el('div', 'color:var(--fgColor-attention,#d29922);margin-bottom:8px;font-size:12px;',
        'The target is a merge commit. Resetting past it uses its first parent.'));
    }
    if (ahead > 0) {
      card.appendChild(el('div', 'color:var(--fgColor-muted,#8d96a0);margin-bottom:8px;font-size:12px;',
        `"Remove only" keeps the ${ahead} newer commit${ahead === 1 ? '' : 's'} but rewrites them with new SHAs ` +
        'and drops any signatures. It stops with no changes if an edit overlaps.'));
    }

    card.appendChild(el('div', 'font-size:12px;margin-bottom:6px;',
      `Type "${branch}" to enable the force actions. They rewrite branch history.`));
    const input = makeInput(branch);
    card.appendChild(input);

    const msg = el('div', 'min-height:18px;margin-top:10px;font-size:12px;word-break:break-word;');
    const showMsg = (text, isError) => {
      msg.style.color = isError ? 'var(--fgColor-danger,#f85149)' : 'var(--fgColor-muted,#8d96a0)';
      msg.textContent = text;
    };
    showMsg('', true);
    card.appendChild(msg);

    const back = makeButton('Back');
    const cancel = makeButton('Cancel');
    const btns = [back, cancel];

    let revert = null;
    let removeOnly = null;
    let wipeFrom = null;
    let resetTo = null;

    if (isHead && parent) {
      revert = makeButton('Revert instead', 'primary');
      btns.push(revert);
    }
    if (ahead > 0) {
      removeOnly = makeButton('Remove only this commit', 'danger');
      btns.push(removeOnly);
    }
    if (parent) {
      wipeFrom = makeButton(ahead > 0 ? `Wipe it + ${ahead} newer` : 'Wipe commit', 'danger');
      btns.push(wipeFrom);
    }
    if (ahead > 0) {
      resetTo = makeButton(`Keep it, wipe ${ahead} newer`, 'danger');
      btns.push(resetTo);
    }

    const forceBtns = [removeOnly, wipeFrom, resetTo].filter(Boolean);
    const setForce = (ok) => {
      forceBtns.forEach((b) => {
        b.disabled = !ok;
        b.style.opacity = ok ? '1' : '.5';
        b.style.cursor = ok ? 'pointer' : 'not-allowed';
      });
    };
    setForce(false);

    card.appendChild(btnRow(...btns));

    input.addEventListener('input', () => setForce(input.value.trim() === branch));
    cancel.addEventListener('click', close);
    back.addEventListener('click', () => renderPick(s));

    const lock = (busy) => {
      btns.concat([input]).forEach((n) => { n.disabled = busy; });
      if (!busy) setForce(input.value.trim() === branch);
    };

    async function run(job, mode) {
      lock(true);
      showMsg('', true);
      try {
        const sha = await job();
        renderDone(s, mode, sha);
      } catch (e) {
        lock(false);
        showMsg(friendly(e), true);
      }
    }

    const forceTo = async (sha) => {
      await ghFetch('PATCH', `${s.base}/git/refs/heads/${encodeURI(branch)}`, { sha, force: true });
      return sha;
    };

    if (removeOnly) {
      removeOnly.addEventListener('click', () => {
        if (removeOnly.disabled) return;
        run(async () => {
          const tip = await rewriteWithout(s, (t) => showMsg(t, false));
          showMsg('Updating branch...', false);
          return forceTo(tip);
        }, 'removed');
      });
    }
    if (wipeFrom) {
      wipeFrom.addEventListener('click', () => {
        if (!wipeFrom.disabled) run(() => forceTo(parent.sha), 'wiped');
      });
    }
    if (resetTo) {
      resetTo.addEventListener('click', () => {
        if (!resetTo.disabled) run(() => forceTo(target.sha), 'wiped');
      });
    }
    if (revert) {
      revert.addEventListener('click', () => {
        run(async () => {
          const created = await ghFetch('POST', `${s.base}/git/commits`, {
            message: `Revert "${firstLine(head.message)}"\n\nReverted ${head.sha} via GitHub Last Commit Wiper UserScript.\n\nhttps://github.com/ItzMeShadow999/Github-QOL`,
            tree: parent.tree.sha,
            parents: [head.sha],
          });
          await ghFetch('PATCH', `${s.base}/git/refs/heads/${encodeURI(branch)}`, {
            sha: created.sha,
            force: false,
          });
          return created.sha;
        }, 'reverted');
      });
    }

    setTimeout(() => input.focus(), 0);
  }

  function renderDone(s, mode, newSha) {
    const { card, close, head, branch } = s;
    card.textContent = '';
    card.appendChild(title(mode === 'removed' ? 'Commit removed' : mode === 'reverted' ? 'Commit reverted' : 'History wiped'));
    card.appendChild(muted(`${s.repo.full_name} \u25B8 ${branch} is now at ${short(newSha)}.`));
    card.appendChild(muted(`Old head: ${head.sha}`));

    const msg = el('div', 'min-height:18px;margin-top:8px;font-size:12px;color:var(--fgColor-danger,#f85149);word-break:break-word;');
    card.appendChild(msg);

    const copy = makeButton('Copy old SHA');
    copy.addEventListener('click', () => {
      GM_setClipboard(head.sha);
      copy.textContent = 'Copied';
    });
    const restore = makeButton('Restore commit');
    restore.addEventListener('click', async () => {
      restore.disabled = true;
      msg.textContent = '';
      try {
        await ghFetch('PATCH', `${s.base}/git/refs/heads/${encodeURI(branch)}`, {
          sha: head.sha,
          force: true,
        });
        restore.textContent = 'Restored';
      } catch (e) {
        restore.disabled = false;
        msg.textContent = friendly(e);
      }
    });
    const reload = makeButton('Reload page', 'primary');
    reload.addEventListener('click', () => location.reload());
    const done = makeButton('Close');
    done.addEventListener('click', close);
    card.appendChild(btnRow(copy, restore, done, reload));
  }

  function injectButton() {
    const existing = document.getElementById(BTN_ID);
    const newActions = document.querySelector('ul[data-testid="repo-header-actions"]');
    const oldActions = document.querySelector('.pagehead-actions.flex-shrink-0.d-none.d-md-inline');
    const actions = newActions || oldActions;

    if (!getContext() || !actions) {
      if (existing) (existing.closest('li') || existing).remove();
      return;
    }
    if (existing) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = 'Wipe Commits';
    btn.addEventListener('click', () => {
      const current = getContext();
      if (current) handleWipeClick(current);
    });

    const li = document.createElement('li');
    if (newActions) {
      btn.style.cssText =
        'background-color:var(--button-danger-bgColor-rest,#da3633);' +
        'color:var(--button-danger-fgColor-rest,#fff);' +
        'border:1px solid var(--button-danger-borderColor-rest,rgba(255,255,255,.1));' +
        'border-radius:6px;height:28px;padding:0 12px;font-size:12px;font-weight:500;' +
        'line-height:20px;cursor:pointer;';
    } else {
      btn.classList.add('btn', 'btn-sm', 'btn-danger');
    }
    li.appendChild(btn);
    actions.insertBefore(li, actions.firstChild);
  }

  let lastPath = '';

  function tick() {
    injectButton();
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      routeTokenPages();
    }
  }

  new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
  tick();
})();
