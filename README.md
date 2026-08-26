# ezechias-studio

Personal resume / portfolio site for Ezechias Mulamba — a single-page React
app with a raymarched WebGL background and a scroll-to-travel navigation.
Audience is recruiters and hiring managers.

**Live:** https://ezechias-studio.vercel.app

## Stack

Vite 6 · React 18 · Three.js (raw GLSL, no helpers)

No CSS file and no Tailwind. Styles are inline objects plus one `<style>`
block for pseudo-selectors, keyframes, and the Google Fonts `@import`.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
npm run preview  # serve the build locally
```

Vite warns that the bundle is over 500 kB. That's Three.js, and it's
expected — ignore it unless you decide to code-split.

## Layout

```
index.html        meta tags, fonts preconnect, root div
src/main.jsx      React entry
src/App.jsx       everything else
public/           favicon.svg, apple-touch-icon.png
```

`src/App.jsx` holds, in order: the GLSL shader source as a template
string, the content arrays, the small presentational components, the page
components, and the default-exported `App`.

## Routes

Five hash routes — `/`, `/work`, `/stack`, `/story`, `/contact` — with a
custom "scroll past the edge to travel" navigation. Scrolling past the
bottom of a page accumulates intent on a meter (`TRAVEL = 480`); when it
fills, a full-screen veil names the destination and the next route loads.
`PageUp` / `PageDown` do the same thing without scrolling.

## Background

A raymarched signed-distance field of merged spheres, lit as an oil slick,
in a GLSL fragment shader. It reacts to the mouse, to scroll, to clicks
(`uPulse`), and floods/swells during route changes (`uFlood` / `uDir`).
Each route shifts the palette via `uHue`.

## Look

Near-black purple `#070211`, hot pink `#FF6FB5`, cyan `#5CE1FF`.
Bricolage Grotesque for headings (800, uppercase, tight tracking), Sora
for body (300), JetBrains Mono for labels. Custom cursor, hidden on
devices without hover.

## Editing the content

Edit the arrays near the top of `src/App.jsx` — don't hunt through JSX:

| Array | Drives |
|---|---|
| `ROUTES` | the five pages, their labels and hue offsets |
| `WORK` | the projects on `/work` |
| `TIMELINE` | the roles on `/story` |
| `STACK` | the rows on `/stack` |

Contact links live in the `Contact` component at the bottom of the file.

## Conventions

- `clamp()` for every font size and padding, so it scales without breakpoints.
- `prefers-reduced-motion` is respected — it disables the travel gesture entirely.
- Reveals use `IntersectionObserver` with a timeout fallback, so content
  still appears if the observer never fires.

## Deploying

Connected to the Vercel project `ezechias-studio`. **Pushes to `main`
deploy to production automatically.** Push any other branch to get a
preview URL. Run `npm run build` before deploying.

## Known gaps

- The Medwave and CodeSpace Academy entries are missing from `TIMELINE`.
  Dates are known — Medwave, Marketing & Development Intern, Aug 2025 –
  Nov 2025; CodeSpace Academy, Software Development Program, 2023 –
  Apr 2024 — but the descriptions still need writing.
- The agency name reads "DogDown Media" in `TIMELINE` and on `/story`;
  elsewhere it is "Down Dog Media". Pick one and make it consistent.
