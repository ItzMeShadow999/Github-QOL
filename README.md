# GitHub UserScripts

A collection of userscripts that add keyboard shortcuts, copy buttons, notification badges, and a much nicer Gist Discover experience to **github.com** and **gist.github.com**.

Every feature exists as a standalone script, and everything is also bundled into three "master" scripts so you can install one file and be done.

## Table of Contents

- [What's Inside](#whats-inside)
- [Which One Should I Install?](#which-one-should-i-install)
- [Installation](#installation)
- [Features in Detail](#features-in-detail)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Spam Filter Rules](#spam-filter-rules)
- [Configuration](#configuration)
- [Known Quirks](#known-quirks)
- [Repository Layout](#repository-layout)
- [Author](#author)
- [License](#license)

## What's Inside

| Script | Runs on | What it does |
| --- | --- | --- |
| **GitHub Repo Control Panel** | `github.com` | Alt+E / Alt+R / Alt+C shortcuts for repo file pages, plus a small legend panel |
| **GitHub Notification Favicon Badge** | `github.com` | Puts a red dot on the tab title and favicon when you have unread notifications |
| **GitHub PR Auto-Expand Diffs** | Pull request pages | Automatically clicks "Load diff" and "Load more files" so big PRs render fully |
| **GitHub Gist Control Panel** | `gist.github.com` | Same shortcuts for gists, plus one-click copy buttons on code blocks |
| **Gist Discover: Actual Pagination** | `gist.github.com/discover` | Prev / Next / jump-to-page controls at the top and bottom of the page |
| **Gist Discover Doomscroll** | `gist.github.com/discover` | Infinite scroll that keeps loading new pages of gists as you go |
| **Gist Discover Spam Filter** | `gist.github.com/discover` | Hides obvious spam and junk gists, with a toggle to reveal them |

## Which One Should I Install?

Pick **one** of these routes. Do not mix a master script with the standalone scripts it contains, or you will get duplicate panels, duplicate buttons, and shortcuts firing twice.

| Option | Contains | Sites |
| --- | --- | --- |
| **The Master GitHub/Gist UserScript** (recommended) | All 7 scripts | `github.com` and `gist.github.com` |
| **Master GitHub UserScript** | Repo Control Panel, Notification Favicon Badge, PR Auto-Expand Diffs | `github.com` only |
| **Master Gist UserScript** | Gist Control Panel, Pagination, Doomscroll, Spam Filter | `gist.github.com` only |
| **Standalone scripts** | Whichever ones you choose | See table above |

The combined script guards each module by hostname and path, so repo logic never runs on Gist and Discover logic only runs on `/discover`.

## Installation

1. Install a userscript manager for your browser:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Firefox, Safari, Opera)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Edge, Firefox)
2. Open the script you want in this repository and click **Raw**. Your userscript manager will offer to install it.
3. Confirm the install, then reload GitHub.

Direct install links:

- [The Master GitHub/Gist UserScript](https://github.com/ItzMeShadow999/Github-QOL/raw/main/master/Master_GitHub_Gist_UserScript.user.js)
- [Master GitHub UserScript](https://github.com/ItzMeShadow999/Github-QOL/raw/main/master/Master_GitHub_UserScript.user.js)
- [Master Gist UserScript](https://github.com/ItzMeShadow999/Github-QOL/raw/main/master/Master_Gist_UserScript.user.js)

The two scripts that copy to your clipboard use the `GM_setClipboard` grant, so your userscript manager may ask for permission the first time.

## Features in Detail

### Repo Control Panel

Adds a compact legend panel to the repository header and registers keyboard shortcuts for file pages:

- Jump from a file view to its editor
- Jump from a file view to the raw file
- Copy `owner/repo` to your clipboard

Shortcuts are ignored while you are typing in an input, textarea, or any editable field.

### Notification Favicon Badge

Watches GitHub's header for the unread notification indicator. When it appears, the script:

- Prefixes the tab title with a `●` dot
- Redraws the favicon on a canvas with a red dot in the top right corner

If the browser blocks the canvas (a cross-origin favicon without CORS headers, for example), the title dot still works. The script also tracks GitHub's client-side navigation so titles never end up with stacked dots.

### PR Auto-Expand Diffs

On pull request pages, finds every button, link, or summary whose text is "Load diff" or "Load more files..." and clicks it for you. It runs once immediately, again after 0.8 seconds and 2 seconds, and keeps watching for new buttons as diffs load. Matching is done on visible text rather than class names, since GitHub changes class names far more often than button copy.

### Gist Control Panel

The Gist version of the control panel, with the same style of legend and a few gist-specific behaviors:

- Alt+E opens the gist editor
- Alt+R opens the raw view
- Alt+C copies the gist ID
- A copy button appears in the corner of every code block, with a green checkmark for two seconds after you click it

### Gist Discover: Actual Pagination

GitHub's Discover page only gives you two buttons. This adds a control bar to the top and bottom of the page with:

- **Prev** and **Next** buttons (Prev is disabled on page 1)
- A current page label
- A number input and **Go** button (or press Enter) to jump to any page

It also re-mounts itself on Turbo navigation events so it survives GitHub's client-side page changes.

### Gist Discover Doomscroll

Infinite scroll for Discover. As you approach the bottom of the list, it fetches the next page, extracts the gist cards, and appends them to the current list.

- Loads before you reach the bottom (1200px preload margin)
- Waits 400ms between requests to be polite to GitHub
- Hides GitHub's native pagination controls
- Updates the URL's `page` parameter as you scroll, without reloading
- Shows a floating status pill with a **Pause / Resume** button
- Stops cleanly when there are no more gists or the list container cannot be found

### Gist Discover Spam Filter

Scans every gist card on Discover against a set of patterns and hides the ones that look like spam. A pill in the top right corner shows how many gists were filtered and lets you **Show** or **Hide** them. A MutationObserver watches for new cards, so it works alongside Doomscroll as pages load in.

## Keyboard Shortcuts

| Shortcut | On github.com | On gist.github.com |
| --- | --- | --- |
| **Alt+E** | Open the current file (`/blob/`) in the editor (`/edit/`) | Open the gist editor |
| **Alt+R** | Open the current file (`/blob/`) as raw (`/raw/`) | Open the gist's raw view |
| **Alt+C** | Copy `owner/repo` | Copy the gist ID |

Alt+R is ignored on edit pages. All shortcuts use the capture phase and stay out of the way while you are typing.

## Spam Filter Rules

Each rule is a case-insensitive regular expression tested against the text content of a gist card.

| Rule | Catches |
| --- | --- |
| Crypto / airdrop scam | "airdrop", "free bitcoin", "USDT flash", "claim your reward/bonus" |
| Wallet address dump | Any 40-character hex address starting with `0x` |
| Mod APK / crack site | "mod apk", "cracked version/download", "keygen", "nulled" |
| Telegram / WhatsApp spam | `t.me/`, `wa.me/`, "join our/my telegram" |
| Adult content spam | "onlyfans", "leaked nudes/videos", "18+ content" |
| Streaming piracy spam | "watch free", "123movies", "putlocker", "hd streaming free" |
| Non-Latin keyword stuffing | 15 or more consecutive Arabic, Thai, or Cyrillic characters |

## Configuration

There is no settings UI. Each script keeps its tunables in constants near the top of the file, so you can edit them directly in your userscript manager.

**Doomscroll**

| Constant | Default | Purpose |
| --- | --- | --- |
| `PRELOAD_MARGIN` | `'1200px'` | How far before the bottom of the page the next load starts |
| `MIN_DELAY_MS` | `400` | Minimum delay before each page request |

**Spam Filter**

Add, remove, or edit entries in the `RULES` array. Each entry is `{ label, re }`.

## Known Quirks

- **Do not double up.** Install a master script or the matching standalone scripts, not both.
- **The spam filter is heuristic.** It will occasionally catch a legitimate gist (a gist that lists Ethereum addresses, for example). Use the **Show** button in the pill to review what was hidden.
- **Pagination bar and Doomscroll together.** Both can run at once, but the bar's page label reflects the page you originally loaded, not how far Doomscroll has scrolled. The **Prev**, **Next**, and jump controls reload the page.
- **Alt+C on github.com** copies the first two path segments of any page, so outside a repository it will copy whatever those segments happen to be.
- **GitHub changes its markup.** Selectors like `.gist-snippet` and `.AppHeader-button--hasIndicator` may need updating if GitHub redesigns those pages.

## Repository Layout

```text
.
├── README.md
├── master/
│   ├── Master_GitHub_Gist_UserScript.user.js   # everything, both sites
│   ├── Master_GitHub_UserScript.user.js        # github.com only
│   └── Master_Gist_UserScript.user.js          # gist.github.com only
└── scripts/
    ├── GitHub_Repo_Control_Panel.user.js
    ├── GitHub_Notification_Favicon_Badge.user.js
    ├── GitHub_PR_Auto-Expand_Diffs.user.js
    ├── GitHub_Gist_Control_Panel.user.js
    ├── Gist_Discover___Actual_Pagination.user.js
    ├── Gist_Discover_Doomscroll.user.js
    └── Gist_Discover_Spam_Filter.user.js
```

## Author

Made by [**ItzMeShadow999**](https://github.com/ItzMeShadow999). Issues and pull requests are welcome at [ItzMeShadow999/Github-QOL](https://github.com/ItzMeShadow999/Github-QOL).

## License

Released under the [MIT License](LICENSE).
