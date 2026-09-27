// ==UserScript==
// @name         GitHub Repo Wiper
// @namespace    https://github.com/ItzMeShadow999
// @version      1.0
// @description  Adds a "Wipe Repo" button that deletes all files in the current repo (repo itself is kept)
// @match        https://github.com/*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

  GM_registerMenuCommand('Set GitHub Token', setToken);

  function setToken() {
    const token = prompt(
      'Enter a GitHub Personal Access Token with "repo" (classic) or ' +
      '"Contents: write" (fine-grained) scope.\n' +
      'Stored locally in Tampermonkey storage, only ever sent to api.github.com.'
    );
    if (token) GM_setValue('gh_wipe_token', token.trim());
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
    if (!token) throw new Error('No token set. Use the Tampermonkey menu → "Set GitHub Token" first.');
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {}),
      },
    });
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
        message: 'Wipe repo files (GitHub Repo Wiper userscript)',
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
    const info = getRepoInfo();
    if (!info) return;
    if (document.getElementById('gh-wipe-repo-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'gh-wipe-repo-btn';
    btn.textContent = 'Wipe Repo';
    btn.style.cssText =
      'background:#da3633;color:#fff;border:1px solid #f85149;border-radius:6px;' +
      'padding:5px 12px;font-size:14px;font-weight:600;cursor:pointer;' +
      'position:fixed;top:80px;right:20px;z-index:9999;box-shadow:0 2px 6px rgba(0,0,0,.3);';
    btn.addEventListener('click', () => handleWipeClick(info));
    document.body.appendChild(btn);
  }

  async function handleWipeClick(info) {
    const typed = prompt(
      `This deletes ALL FILES in "${info.owner}/${info.repo}". The repo itself is kept, but this ` +
      `is a new commit on ${info.repo}'s default branch — old commits stay in history but the ` +
      `working tree becomes empty.\n\nType the repo name "${info.repo}" to confirm:`
    );
    if (typed !== info.repo) {
      alert('Confirmation text did not match. Aborted.');
      return;
    }

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

  new MutationObserver(injectButton).observe(document.documentElement, { childList: true, subtree: true });
  injectButton();
})();