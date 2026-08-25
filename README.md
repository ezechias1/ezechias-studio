# ezechias-studio

The resume / portfolio site. Audience is recruiters and hiring managers.

**Live:** https://ezechias-studio.vercel.app

Its sibling is [`ezechias-freelance`](https://github.com/ezechias1/ezechias-freelance) —
the services site aimed at clients. The two share a lineage but are
deliberately different in structure and look. Keep them that way.

---

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # always run before deploying
```

Vite warns that the bundle is over 500 kB. That's Three.js, and it's
expected — ignore it unless you decide to code-split.

## How it's built

Vite + React 18 + Three.js. Everything lives in [`src/App.jsx`](src/App.jsx):
the shader source as a template string, the content arrays, small
presentational components, and the default-exported `App`.

There is no CSS file and no Tailwind. Styles are inline objects, plus a
single `<style>` block for pseudo-selectors, keyframes, and the Google
Fonts `@import`.

### Structure

Five hash routes — `/`, `/work`, `/stack`, `/story`, `/contact` — with a
custom "scroll past the edge to travel" navigation. Scrolling past the
bottom of a page accumulates intent on a meter (`TRAVEL = 480`); when it
fills, a full-screen veil names the destination and the next route loads.
`PageUp` / `PageDown` do the same thing without scrolling.

### Look

Near-black purple `#070211`, hot pink `#FF6FB5`, cyan `#5CE1FF`.
Bricolage Grotesque for headings (800, uppercase, tight tracking), Sora
for body (300), JetBrains Mono for labels. Custom cursor, hidden on
devices without hover.

### Background

A raymarched signed-distance field of merged spheres, lit as an oil
slick, in a GLSL fragment shader. It reacts to the mouse, to scroll, to
clicks (`uPulse`), and floods/swells during route changes
(`uFlood` / `uDir`). Each route shifts the palette via `uHue`.

## Changing the content

Edit the arrays near the top of `src/App.jsx` — don't hunt through JSX:

| Array | Drives |
|---|---|
| `ROUTES` | the five pages, their labels and hue offsets |
| `WORK` | the projects on `/work` |
| `TIMELINE` | the roles on `/story` |
| `STACK` | the rows on `/stack` |

## Conventions

- `clamp()` for every font size and padding, so it scales without breakpoints.
- `prefers-reduced-motion` is respected — it disables the travel gesture entirely.
- Reveals use `IntersectionObserver` with a timeout fallback, so content
  still appears if the observer never fires.

## Deploying

Connected to the Vercel project `ezechias-studio`
(`prj_PAynRt4tMlAOddNBUdjB8H9zm4vJ`). **Pushes to `main` deploy to
production automatically.** Push a branch instead to get a preview URL.

## Facts that must stay correct

These have regressed before. Check them any time you touch contact
details or copy.

- **WhatsApp:** `0682531230`, linked as `https://wa.me/27682531230`
- **Email:** ezechiasmulamba@gmail.com
- **GitHub:** github.com/ezechias1
- **Location:** Cape Town, South Africa

**Professional experience is measured from Nov 2025**, not 2023. An early
version claimed "SHIPPING SINCE 2023" and "3 years" — both wrong, both
corrected. Don't reintroduce tenure claims in new copy. The honest and
stronger framing is the pace: first freelance job to headless CMS
migrations and a registered company in under a year.

## Known gaps

- **The source in this repo was reconstructed from the production
  bundle.** Both Vercel projects were originally created by direct file
  upload, so the source was never committed and no local copy survived.
  Content and shader were verified string-for-string against the live
  bundle, but this is a reconstruction, not the original files.
- **The Medwave and CodeSpace Academy timeline entries are missing.**
  They were built and verified in an earlier session but never pushed,
  so their copy existed only in that lost build. The dates are known —
  Medwave, Marketing & Development Intern, Aug 2025 – Nov 2025;
  CodeSpace Academy, Software Development Program, 2023 – Apr 2024 —
  but the descriptions need rewriting from source.
- **The agency name is unconfirmed.** This site says "DogDown Media";
  the CV says "Down Dog Media". Verify before it goes anywhere that
  matters.
