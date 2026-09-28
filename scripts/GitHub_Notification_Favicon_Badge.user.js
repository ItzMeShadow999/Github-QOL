// ==UserScript==
// @name         GitHub Notification Favicon Badge
// @namespace    https://github.com
// @version      1.0.0
// @description  Puts a red dot on the browser tab (title + favicon) whenever GitHub's own header shows unread notifications, so you can tell from another tab without checking the bell.
// @author       ItzMeShadow999
// @homepageURL  https://github.com/ItzMeShadow999/Github-QOL
// @supportURL   https://github.com/ItzMeShadow999/Github-QOL/issues
// @downloadURL  https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/GitHub_Notification_Favicon_Badge.user.js
// @updateURL    https://github.com/ItzMeShadow999/Github-QOL/raw/main/scripts/GitHub_Notification_Favicon_Badge.user.js
// @match        https://github.com/*
// @icon         https://i.ibb.co/XxSnS9h9/64880b9b0fe5b53bbe3f7280d262b33f.jpg
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const INDICATOR_SELECTOR = '.AppHeader-button--hasIndicator, .mail-status.unread';

  let originalTitle = document.title;
  let faviconLink = document.querySelector('link[rel~="icon"]');
  let originalFaviconHref = faviconLink ? faviconLink.href : null;
  let badgeHref = null;

  function hasUnread() {
    return !!document.querySelector(INDICATOR_SELECTOR);
  }

  function buildBadgedFavicon(callback) {
    if (badgeHref || !originalFaviconHref) return callback(badgeHref);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);

        ctx.beginPath();
        ctx.arc(size - 7, 7, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(size - 7, 7, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#e5423e';
        ctx.fill();

        badgeHref = canvas.toDataURL('image/png');
      } catch (err) {
        badgeHref = null;
      }
      callback(badgeHref);
    };
    img.onerror = () => callback(null);
    img.src = originalFaviconHref;
  }

  function applyBadge(on) {
    document.title = on ? `\u25CF ${originalTitle}` : originalTitle;

    if (!faviconLink) return;
    if (!on) {
      faviconLink.href = originalFaviconHref;
      return;
    }
    buildBadgedFavicon((href) => {
      if (href) faviconLink.href = href;
    });
  }

  let lastState = null;
  function check() {
    const unread = hasUnread();
    if (unread === lastState) return;
    lastState = unread;
    applyBadge(unread);
  }

  const titleObserver = new MutationObserver(() => {
    if (lastState !== true) {
      originalTitle = document.title;
    } else if (!document.title.startsWith('\u25CF ')) {
      originalTitle = document.title;
      applyBadge(true);
    }
  });
  const titleEl = document.querySelector('head > title');
  if (titleEl) titleObserver.observe(titleEl, { childList: true });

  const bodyObserver = new MutationObserver(check);
  bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  check();
})();