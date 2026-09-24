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

  // GitHub adds this modifier class to the inbox button in the header
  // whenever there are unread notifications. So helpful of them.
  const INDICATOR_SELECTOR = '.AppHeader-button--hasIndicator, .mail-status.unread'; // GitHub's selectors change more often than my mood

  let originalTitle = document.title; // Save it before we mess it up
  let faviconLink = document.querySelector('link[rel~="icon"]'); // Find the favicon, assuming it exists
  let originalFaviconHref = faviconLink ? faviconLink.href : null; // Might be null, who knows
  let badgeHref = null; // cached data-url of favicon-with-dot, built once because we're efficient

  function hasUnread() {
    return !!document.querySelector(INDICATOR_SELECTOR); // Double bang because we're extra
  }

  function buildBadgedFavicon(callback) {
    if (badgeHref || !originalFaviconHref) return callback(badgeHref);

    const img = new Image();
    img.crossOrigin = 'anonymous'; // Cross-origin issues, the gift that keeps on giving
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);

        // red dot, top-right because that's where notifications go apparently
        ctx.beginPath();
        ctx.arc(size - 7, 7, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff'; // White border for contrast, so thoughtful right?
        ctx.fill();
        ctx.beginPath();
        ctx.arc(size - 7, 7, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#e5423e'; // GitHub red, how original
        ctx.fill();

        badgeHref = canvas.toDataURL('image/png'); // Convert to data URL, magic
      } catch (err) {
        // canvas got tainted (cross-origin asset without CORS headers) or
        // some other issue, fall back to title-only badge below
        badgeHref = null;
      }
      callback(badgeHref); // Return whatever we got, if anything
    };
    img.onerror = () => callback(null); // Image failed? Whatever, move on
    img.src = originalFaviconHref; // Load the favicon, hopefully :pray: XD
  }

  function applyBadge(on) {
    document.title = on ? `\u25CF ${originalTitle}` : originalTitle; // Add dot or remove it, simple

    if (!faviconLink) return; // No favicon element? Can't do anything then
    if (!on) {
      faviconLink.href = originalFaviconHref;
      return;
    }
    buildBadgedFavicon((href) => {
      if (href) faviconLink.href = href; // Apply the badged version
      // if href is null the canvas approach failed silently, title badge still applies
      // Silent failure is the best failure!!
    });
  }

  let lastState = null;
  function check() {
    const unread = hasUnread();
    if (unread === lastState) return;
    lastState = unread;
    applyBadge(unread);
  }

  // Keep originalTitle in sync when GitHub's own SPA navigation changes the page title,
  // so we don't end up stacking multiple dots or badging the wrong title.
  // GitHub's SPA is so considerate about changing titles randomly.
  const titleObserver = new MutationObserver(() => {
    if (lastState !== true) {
      originalTitle = document.title;
    } else if (!document.title.startsWith('\u25CF ')) {
      // title changed underneath us while badged, recapture and reapply
      originalTitle = document.title;
      applyBadge(true);
    }
  });
  const titleEl = document.querySelector('head > title'); // Find the title element
  if (titleEl) titleObserver.observe(titleEl, { childList: true }); // Watch it like a creep

  const bodyObserver = new MutationObserver(check);
  bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  check(); // Initial check, might as well
})();