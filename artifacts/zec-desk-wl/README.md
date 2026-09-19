# ZEC DESK — WL Access Terminal

Standalone whitelist page. Drop these files onto the existing site. No build step.

## Files

```
wl.html
src/css/wl.css
src/js/wl.js
```

## Flow

1. X username
2. Three social quests
3. Stage 03 reveal → **Enter next stage**

There is no game, wallet, or address form on this page.

## Attach

1. Copy `wl.html`, `src/css/wl.css`, and `src/js/wl.js` into the live site.
2. Route `/wl` (or `/whitelist`) to `wl.html`.
3. In `src/js/wl.js`, set:

```js
var WL_CONFIG = {
  officialX: "https://x.com/YOUR_PROJECT",
  announcementX: "https://x.com/YOUR_ANNOUNCEMENT_POST",
  homeUrl: "/",
  nextStageUrl: "REPLACE_WITH_NEXT_STAGE_URL",
  storageKey: "zec_wl_progress",
  themeKey: "zec_wl_theme",
};
```

Replace `REPLACE_WITH_NEXT_STAGE_URL` with the real Stage 04 URL.

Quest copy and Stage 03 wording live in `wl.html`.
