---
paths:
  - "src/components/**"
  - "src/pages/**/*.astro"
  - "src/layouts/**"
  - "src/styles/**"
---

# Kid-friendly UI

- Mobile first: kids use phones. Touch targets at least 44px, no hover-only interactions, no horizontal scroll.
- Text is short, Spanish, and encouraging. Young students ("Peques") can't read well: pair text with an emoji/icon and support the Spanish voice (`speak`).
- Every success gets immediate feedback: confetti (`src/lib/fx.ts`), a sound (`src/lib/sfx.ts`) and the mascot. Mistakes are gentle: never red screens or punishing language.
- Colors from Tailwind theme tokens, with enough contrast (WCAG AA) for text on colorful backgrounds. Don't rely on color alone.
- Keep animation optional: respect `prefers-reduced-motion` and let sound be muted.
- Use Astro components for static content and Preact islands (`client:load`/`client:visible`) only where interaction is needed.
- Coach and projector screens are used on laptops and big displays: use large type and clear contrast for the classroom.
