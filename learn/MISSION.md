# Mission: How the next-fe debugger extension works

## Why
I have a working Chrome extension (`next-fe debugger`) that inspects Next.js pages, and I want to genuinely understand its code: where it starts, how each piece talks to the others, and the mechanism behind every feature. Once I do, I can debug it, extend it, and explain it to teammates with confidence instead of treating it as a black box.

## Success looks like
- Point at any file in `src/` and say who starts it, when, and what it can see (the page? the DOM? Chrome APIs?).
- Trace each feature end to end from a user action to pixels: badge, keyboard shortcuts, Version, API Fetch, Page Data, dataLayer, live updates.
- Explain why the non-obvious rules exist (e.g. `readNextData` must be self-contained, content scripts can't import, `gateway-hook` runs in the MAIN world at `document_start`).
- Add a small feature or fix a bug in the extension without guessing.

## Constraints
- Learn from this repo's real code, not toy examples.
- Short lessons, one mechanism at a time.

## Out of scope
- Chrome Web Store publishing, packaging and review.
- Next.js internals beyond what `__NEXT_DATA__` is and where it comes from.
- Visual design / CSS of the extension (`tree.css`), unless needed to understand a feature.

> Draft inferred from the request on 2026-10-06; confirm or correct the "Why".
