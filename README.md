# farid-inawan.dev

Personal site of **Farid Inawan**. The landing page is a scroll-driven [three.js](https://threejs.org) particle animation: a rotating globe of 2,048 points that vortex-swirls through two text scenes as you scroll.

🔗 **Live:** https://frdteknikelektro.github.io/farid-inawan.dev/

## How it works

The whole intro is a single `<canvas>` driven by scroll position. Particles never spawn or die — the same 2,048 points are continuously re-targeted between scenes:

1. **Globe** — points placed on a Fibonacci sphere, slowly spinning.
2. **"Hi! I'm Farid"** — text rasterized to an offscreen canvas, then sampled into point targets.
3. **"Currently building…"** — second text scene.

Each transition is a **vortex swirl**: points spiral around the Y axis, peaking at the flight midpoint and unwinding to zero at both ends so they land exactly on target. Vertical rank is preserved (top→top, bottom→bottom). Scenes sit one viewport apart and reveal as you scroll, with a 10% static "hold" on each.

Extra touches:

- Pointer / touch acts as a brush that pushes nearby particles around (with a click "shockwave").
- The camera auto-fits the widest formation, so text never clips on portrait / mobile; particle size compensates for the camera distance.

The core lives in [`app/components/ParticleGlobe.tsx`](app/components/ParticleGlobe.tsx).

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, static export)
- [React 19](https://react.dev)
- [three.js](https://threejs.org)
- [Tailwind CSS 4](https://tailwindcss.com)
- TypeScript

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build   # static export to ./out
```

## Deployment

Hosted on **GitHub Pages** from the `gh-pages` branch. To publish the current `main`:

```bash
npm run deploy
```

This builds a static export with the correct base path and pushes `./out` to the `gh-pages` branch.

> Using a custom domain (`farid-inawan.dev`)? Drop `NEXT_PUBLIC_BASE_PATH` from the deploy script (so `basePath` is empty), add a `public/CNAME` file with the domain, and point your DNS at GitHub Pages.

## License

[MIT](LICENSE) © Farid Inawan
