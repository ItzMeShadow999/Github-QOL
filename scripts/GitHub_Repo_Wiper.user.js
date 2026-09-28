// ==UserScript==
// @name         GitHub Repo Wiper
// @namespace    https://github.com/ItzMeShadow999
// @version      1.9
// @description  Adds a "Wipe Repo" button that deletes all files in the current repo (repo itself is kept)
// @author       ItzMeShadow999
// @match        https://github.com/*/*
// @icon         https://i.ibb.co/XxSnS9h9/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/ItzMeShadow999/Github-QOL/main/scripts/GitHub_Repo_Wiper.user.js
// @downloadURL  https://raw.githubusercontent.com/ItzMeShadow999/Github-QOL/main/scripts/GitHub_Repo_Wiper.user.js
// ==/UserScript==

(function () {
  'use strict';

  const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  const TOKEN_DESCRIPTION = 'Repo Wiper UserScript';
  const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Repo%20Wiper%20UserScript';
  const TOKENS_LIST_URL = 'https://github.com/settings/tokens';
  const AUTOGEN_TTL = 5 * 60 * 1000;
  const AUTO_TIMEOUT = 2 * 60 * 1000;
  const TOKEN_RE = /\b(ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/;

  let onAutoToken = null;

  GM_registerMenuCommand('Set GitHub Token', setToken);

  if (typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener('gh_wipe_autotoken', () => {
      if (onAutoToken) onAutoToken();
    });
  }

  clearStaleAutoToken();

  function clearStaleAutoToken() {
    const raw = GM_getValue('gh_wipe_autotoken', '');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (Date.now() - data.ts < AUTOGEN_TTL) return;
    } catch (e) {}
    GM_setValue('gh_wipe_autotoken', '');
  }

  function setToken() {
    return showTokenCard();
  }

  function createCardShell(id) {
    const old = document.getElementById(id);
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:100000;background:rgba(1,4,9,.6);' +
      'display:flex;align-items:center;justify-content:center;';

    const card = document.createElement('div');
    card.style.cssText =
      'width:min(440px,92vw);padding:20px;border-radius:12px;font-size:14px;' +
      'background:var(--overlay-bgColor,var(--bgColor-default,#0d1117));' +
      'color:var(--fgColor-default,#e6edf3);' +
      'border:1px solid var(--borderColor-default,#30363d);' +
      'box-shadow:0 8px 32px rgba(1,4,9,.5);';

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

  async function validateAndStore(token) {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(res.status === 401 ? 'GitHub rejected that token.' : `GitHub API ${res.status}`);
    GM_setValue('gh_wipe_token', token);
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

      const { overlay, card } = createCardShell('gh-wipe-token-overlay');

      const msg = document.createElement('div');
      msg.style.cssText = 'min-height:18px;margin-top:10px;font-size:12px;color:var(--fgColor-danger,#f85149);';

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
        GM_setValue('gh_wipe_autogen', 0);
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
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;';
        const cancelBtn = makeButton('Cancel');
        cancelBtn.addEventListener('click', () => close(false));
        row.append(cancelBtn);
        card.append(row);
      }

      function renderManual(reason) {
        mode = 'manual';
        stopPolling();
        GM_setValue('gh_wipe_autogen', 0);
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

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;';
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
        GM_setValue('gh_wipe_autotoken', '');
        GM_setValue('gh_wipe_autofail', 0);
        GM_setValue('gh_wipe_autogen', startedAt);
        GM_setValue('gh_wipe_autogen_click', 0);

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

        const raw = GM_getValue('gh_wipe_autotoken', '');
        let data = null;
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (e) {}
        }
        if (data && data.token) {
          GM_setValue('gh_wipe_autotoken', '');
          stopPolling();
          closeAutoTab();
          adopt(data.token);
          return;
        }

        if (Number(GM_getValue('gh_wipe_autofail', 0))) {
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

  function showConfirmCard(info) {
    return new Promise((resolve) => {
      const { overlay, card } = createCardShell('gh-wipe-confirm-overlay');

      const title = document.createElement('div');
      title.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:8px;';
      title.textContent = `Wipe ${info.owner}/${info.repo}?`;

      const body = document.createElement('div');
      body.style.cssText = 'margin-bottom:12px;color:var(--fgColor-muted,#8d96a0);';
      body.textContent =
        `This deletes ALL FILES in ${info.owner}/${info.repo}. The repo itself is kept. ` +
        'It adds one new commit on the default branch, old commits stay in history, ' +
        'and the working tree becomes empty.';

      const label = document.createElement('div');
      label.style.cssText = 'margin-bottom:8px;';
      const strong = document.createElement('strong');
      strong.textContent = info.repo;
      label.append('Paste or type ', strong, ' to confirm:');

      const input = makeInput(info.repo);

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:14px;';

      const cancelBtn = makeButton('Cancel');
      const wipeBtn = makeButton('Wipe repo', 'danger');
      wipeBtn.disabled = true;
      wipeBtn.style.opacity = '.5';
      wipeBtn.style.cursor = 'not-allowed';

      row.append(cancelBtn, wipeBtn);
      card.append(title, body, label, input, row);
      document.body.appendChild(overlay);
      input.focus();

      const matches = () => input.value.trim() === info.repo;

      function finish(value) {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        resolve(value);
      }

      const onKey = (e) => {
        if (e.key === 'Escape') finish(false);
        if (e.key === 'Enter' && matches()) finish(true);
      };

      input.addEventListener('input', () => {
        const ok = matches();
        wipeBtn.disabled = !ok;
        wipeBtn.style.opacity = ok ? '1' : '.5';
        wipeBtn.style.cursor = ok ? 'pointer' : 'not-allowed';
      });

      document.addEventListener('keydown', onKey, true);
      wipeBtn.addEventListener('click', () => {
        if (matches()) finish(true);
      });
      cancelBtn.addEventListener('click', () => finish(false));
      overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) finish(false);
      });
    });
  }

  function autogenPending() {
    const t = Number(GM_getValue('gh_wipe_autogen', 0));
    return t > 0 && Date.now() - t < AUTOGEN_TTL;
  }

  function showPageNote(text) {
    const n = document.createElement('div');
    n.textContent = text;
    n.style.cssText =
      'position:fixed;bottom:20px;right:20px;z-index:100000;max-width:340px;padding:10px 14px;border-radius:8px;font-size:14px;' +
      'background:var(--bgColor-default,#0d1117);color:var(--fgColor-default,#e6edf3);' +
      'border:1px solid var(--borderColor-default,#30363d);box-shadow:0 8px 24px rgba(1,4,9,.5);';
    document.body.appendChild(n);
  }

  function signalFail(note) {
    if (!autogenPending()) return;
    GM_setValue('gh_wipe_autofail', Date.now());
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
      const last = Number(GM_getValue('gh_wipe_autogen_click', 0));
      if (Date.now() - last < 10000) return;
      GM_setValue('gh_wipe_autogen_click', Date.now());
      setTimeout(() => btn.click(), 1200);
    }, 250);
  }

  function handleTokensListPage() {
    if (!autogenPending()) return;
    const clicked = Number(GM_getValue('gh_wipe_autogen_click', 0));
    if (!clicked || Date.now() - clicked > AUTOGEN_TTL) return;
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById('new-oauth-token');
      let token = el && el.textContent.trim();
      if (!token) {
        const m = document.body.innerText.match(TOKEN_RE);
        token = m && m[1];
      }
      if (token) {
        clearInterval(timer);
        GM_setClipboard(token);
        GM_setValue('gh_wipe_autotoken', JSON.stringify({ token, ts: Date.now() }));
        GM_setValue('gh_wipe_autogen', 0);
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

  function getToken() {
    return GM_getValue('gh_wipe_token', null);
  }

  function getRepoInfo() {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const skip = ['settings', 'issues', 'pulls', 'actions', 'projects', 'wiki', 'security', 'pulse', 'graphs', 'network'];
    if (skip.includes(parts[2])) return null;
    return { owner: parts[0], repo: parts[1] };
  }

  async function ghFetch(url, options = {}) {
    const token = getToken();
    if (!token) throw new Error('No token set.');
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) {
      GM_setValue('gh_wipe_token', '');
      throw new Error('GitHub rejected the saved token. Click Wipe Repo again to set up a new one.');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`GitHub API ${res.status}: ${body || res.statusText}`);
    }
    return res.status === 204 ? null : res.json();
  }

  async function wipeRepo(owner, repo) {
    const repoData = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`);
    const branch = repoData.default_branch;

    const refData = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    const latestCommitSha = refData.object.sha;

    const newCommit = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Wiped repo via GitHub Repo Wiper UserScript.\n\nhttps://github.com/ItzMeShadow999/Github-QOL',
        tree: EMPTY_TREE_SHA,
        parents: [latestCommitSha],
      }),
    });

    await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });

    return { branch, newCommitSha: newCommit.sha };
  }

  function injectButton() {
    const existing = document.getElementById('gh-wipe-repo-btn');
    const newActions = document.querySelector('ul[data-testid="repo-header-actions"]');
    const oldActions = document.querySelector('.pagehead-actions.flex-shrink-0.d-none.d-md-inline');
    const actions = newActions || oldActions;

    if (!getRepoInfo() || !actions) {
      if (existing) (existing.closest('li') || existing).remove();
      return;
    }
    if (existing) return;

    const btn = document.createElement('button');
    btn.id = 'gh-wipe-repo-btn';
    btn.type = 'button';
    btn.textContent = 'Wipe Repo';
    btn.addEventListener('click', () => {
      const current = getRepoInfo();
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

  async function handleWipeClick(info) {
    if (!getToken()) {
      const saved = await showTokenCard();
      if (!saved) return;
    }

    const confirmed = await showConfirmCard(info);
    if (!confirmed) return;

    const btn = document.getElementById('gh-wipe-repo-btn');
    const original = btn.textContent;
    btn.textContent = 'Wiping…';
    btn.disabled = true;

    try {
      const result = await wipeRepo(info.owner, info.repo);
      alert(`Done. All files removed from ${info.owner}/${info.repo} (${result.branch}).\nNew commit: ${result.newCommitSha}`);
      location.reload();
    } catch (err) {
      console.error(err);
      alert(`Wipe failed: ${err.message}`);
    } finally {
      btn.textContent = original;
      btn.disabled = false;
    }
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
