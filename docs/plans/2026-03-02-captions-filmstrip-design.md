# Captions Filmstrip Showcase Design

## Context
The Instagram phone mockup for the Captions feature felt gimmicky — simulating another platform rather than showcasing our product. Replace with a horizontal filmstrip that shows the complete carousel output at a glance.

## Design

### Layout
- Section wrapper unchanged: text left (45%), demo right (55%), cyan gradient
- Demo area: 4 slides in a flat horizontal row, gap-2 (8px), rounded-xl
- Each slide: ~9:16 aspect ratio, sized to fit 4 across (~130px wide on desktop)
- Images already have caption text baked in ("HEYY", "DID YOU", "SEE OUR", "LATEST FEATURE")

### Animation
- Trigger: `useInView` with `amount: 0.3`
- Each slide: `initial={{ opacity: 0, x: 40 }}` → `animate={{ opacity: 1, x: 0 }}`
- Staggered delay: index * 0.15s (0ms, 150ms, 300ms, 450ms)
- Duration: 0.5s, ease: `[0.16, 1, 0.3, 1]`
- After all slides land: subtle cyan glow fades in behind strip
- No looping, no interaction, no auto-cycle. One-shot staggered entrance.

### Component: CaptionsDemo
~40 lines replacing the current ~195 line component. No state, no timers, no drag handlers.

```
Props: { slides: Array<{ src: string; caption: string }> }

- Outer div: ref for useInView, flex row, gap-2, relative
- Glow div: absolute behind strip, opacity 0 → 1 after last slide
- 4x motion.div: rounded-xl, overflow-hidden, aspect-[9/16]
  - img: w-full h-full object-cover
  - Staggered entrance animation
- caption prop used as alt text only
```

### Files Changed
| File | Action |
|------|--------|
| `src/components/marketing/captions-demo.tsx` | Rewrite (195 → ~40 lines) |

No other files changed. Landing page wrapper stays identical.

## Deleted
- Instagram chrome (notch, header, avatar, action bar, dots, caption text)
- All interactivity (drag, swipe, tap zones, keyboard, auto-advance timers)
- AnimatePresence, direction tracking, state management
