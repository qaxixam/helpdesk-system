# Design system — "Glass Ward" (v2)

Source of truth: `src/app/globals.css` (tokens), `src/components/ui/*`
(primitives), `src/components/badges.tsx`, `src/components/kpi.tsx`,
`src/components/sla.tsx`, `src/components/charts.tsx`. This file is a
*reference*, not a spec written in advance — if you change a token or add a
pattern, update this file in the same change so it stays true.

> **2026-11-05 — replaced the flat "Ward" material with Glassmorphism +
> Bento Grid, by explicit user request** (the clinical flat-white material
> is still described below where it's still true — neutrals, ink, triage
> colors are unchanged — but every surface is now frosted glass over a
> soft gradient backdrop, and KPI/summary rows are asymmetric bento grids,
> not flat strips). See "Glass material" and "Bento grids" sections below.

## Concept

Hospital IT helpdesk. The vernacular is the ward: triage colors, monitor
read-outs, chart paper, bedside-clipboard calm. Surfaces float as frosted
glass over a soft cyan/teal gradient backdrop, ink is a deep scrubs green,
the action color is surgical teal. **Triage colors (urgent/high/medium/low)
are reserved for priority & SLA only** — never reused as decorative accents.
Red/amber anywhere in this app
means "time matters," full stop.

Tone: calm, dense-but-legible, information-first. Not playful, not
corporate-SaaS-marketing. Nothing should look like a landing page.

## Tokens (`globals.css` → `@theme`)

**Neutrals** (cool, faintly green)
| token | hex | use |
|---|---|---|
| `--color-canvas` | `#f4f6f4` | page background |
| `--color-surface` | `#ffffff` | panels, cards |
| `--color-sunken` | `#eef1ef` | input backgrounds, track/meter backgrounds |
| `--color-line` | `#dfe5e2` | default borders, dividers |
| `--color-line-strong` | `#c7d0cc` | input borders, stronger dividers |
| `--color-ink` | `#13201f` | primary text |
| `--color-ink-2` | `#3f4d4b` | secondary text |
| `--color-ink-3` | `#6b7876` | tertiary / meta text |
| `--color-ink-4` | `#97a29f` | placeholder, faintest text |

**Brand (teal)** — `teal-50`→`teal-900`, action color. Primary buttons,
active nav, links: `teal-500`/`teal-600`(hover)/`teal-700`(text links).

**Sidebar** — separate near-black scale (`--color-ward*`, `--color-ward-ink`)
used only by `AppShell`'s sidebar, not elsewhere.

**Triage** (priority + SLA *only*, never decorative)
| state | text | soft bg |
|---|---|---|
| urgent | `#c8372a` | `#fbeae8` |
| high | `#c2701a` | `#fbf0e3` |
| medium | `#2d64b8` | `#e8eff9` |
| low | `#5d6b69` | `#eef1f0` |

**Status** (resolved/good vs. waiting/warn — distinct from triage)
`--color-ok` `#1f8a4c` / `--color-ok-soft`, `--color-warn` `#b7791f` /
`--color-warn-soft`.

**Chart series** (`charts.tsx`, fixed order, never cycled, CVD-safe at ≥3:1
on white): teal `#0b9a8a` → blue `#4268d6` → ochre `#c9822b`. Chart grid
`#e6ebe8`, axis `#97a29f`.

**Radii** `sm` 6px · `md` 8px · `lg` 12px (panels, default) · `xl` 16px.
**Shadows** `shadow-raise` (hairline, for panels/surfaces at rest) ·
`shadow-pop` (modals, tooltips, popovers only — don't use it on resting UI).

## Typography

Sans: Instrument (var `--font-instrument`). Mono (ticket IDs, numeric
read-outs): IBM Plex Mono (var `--font-plex-mono`), applied via the `.num`
utility class (`font-variant-numeric: tabular-nums` — use `.num` on any
right-aligned or comparison numeric column, not just literal mono font).

Scale in actual use (this app doesn't use Tailwind's default text-sm/base/lg
ramp — it uses arbitrary pixel values deliberately, for a tighter, denser
feel than the default scale gives):

| size | weight | use |
|---|---|---|
| 28/26px, `font-semibold`, `tracking-[-0.02em]` | page `<h1>` (`AppShell`) |
| 15px, `font-semibold` | panel/section headers |
| 14.5px / 14px | body copy, message text |
| 13.5px | secondary labels, nav items |
| 13px | meta text, descriptions, table body default |
| 12.5px | dense table/row meta, badges |
| 12px / 11.5px | smallest meta (timestamps, hint text) |

Default body is **13px**, not 14 or 16 — this is a dense, information-first
app, not a marketing page. Don't bump sizes up "for clarity"; use weight
and color (ink vs ink-2 vs ink-3) for hierarchy instead of size.

## Spacing & density

This app runs tighter than default Tailwind spacing habits:
- Panel padding: `px-5 py-4` for headers, `px-4`/`px-5` for row content.
- Row vertical rhythm: `py-3` to `py-3.5` for list/table rows — not `py-4`+.
- Gaps between related inline items: `gap-1.5`/`gap-2`. Between unrelated
  blocks: `gap-3`/`gap-6`.
- Section-to-section spacing on a page: `mt-6`, not more. Don't let
  sections drift apart — this reads as "empty AI-generated dashboard," not
  "spacious." If two columns in a grid differ a lot in content length,
  that's a sign the grid/column split is wrong, not that more padding is
  needed — restructure instead of padding out the short column.

## Component inventory (don't rebuild, reuse)

- **`Panel`** (`ui/primitives.tsx`) — the one card container:
  `rounded-lg border border-line bg-surface shadow-raise`. Everything that
  looks like a "card" should be a `Panel`, and a `Panel` should not also
  get its own extra shadow/border from a parent.
- **`VitalsStrip`** (`kpi.tsx`) — the KPI pattern. **One bordered grid with
  hairline (1px) dividers between cells**, not separate floating cards.
  Alert cells get a 3px red rule on the left edge, not a different
  background. This is deliberate: a row of separate rounded-xl cards with
  icon bubbles is the generic AI-dashboard look this project has already
  rejected once — don't reintroduce it.
- **`TicketRows`** (`ticket-list.tsx`) — the dense single-column row
  pattern used below `md` and in narrow dashboard columns: ticket id +
  category on top, title, then status · person · SLA read-out on one line,
  with an inset rounded SLA meter (3px, `bg-line` track) under the content
  — not a full-bleed line (that reads as a divider, not a meter; this was
  an actual mistake made and fixed in this project).
- **`SlaInline`** / **`SlaTraceLine`** (`sla.tsx`) — compact one-line SLA
  read-out + the inset meter, for dense rows. `SlaCell`/`SlaTrace` are the
  fuller versions for a standalone table column or the ticket detail
  sidebar — don't use the full version where the compact one fits.
- **Badges** (`badges.tsx`) — `StatusBadge` (dot + label, quiet, color
  reserved for triage not status), `PriorityBadge` (filled pill + 4-bar
  signal strength icon), `RoleBadge` (small filled pill: admin=ward-dark,
  agent=teal-soft, user=neutral soft; accepts a `label` override — used for
  "Me" on the current user's own messages in a ticket thread).
- **`HBarList`/`WorkloadChart`/`FlowChart`** (`charts.tsx`) — use these for
  any categorical/time-series chart rather than hand-rolling a new chart
  component; they already carry the validated palette and tooltip style.
- Form controls (`ui/field.tsx`): `Input`/`Select`/`Textarea` share one
  `control` class string (h-10, `border-line-strong`, teal focus ring).
  Don't invent new input styling per-screen.

## Layout shell

`AppShell` (`app-shell.tsx`) owns the page chrome: fixed 240px sidebar on
`lg:+`, slide-over drawer below. Content max-width `1320px`, horizontal
padding `px-4` → `sm:px-6` → `lg:px-10`. Page header is title + optional
description + optional actions, `mb-7`. Don't rebuild this shell per page —
every `page.tsx` renders inside `<AppShell>` and only supplies
`title`/`description`/`actions`/`children`.

## Responsive rules already established

- Tables (`ticket-list.tsx` desktop `<table>`) use `w-px` + `whitespace-nowrap`
  on every column except the one that should take the slack (`max-w-0` +
  `truncate`). Secondary columns progressively hide: `lg:table-cell` for
  Requester/Assignee, `xl:table-cell` for Opened. Never `overflow-x-auto` a
  table as a fix — resize/hide columns at the breakpoint instead.
- Below `md`, tables become `TicketRows` (row-card pattern), not a
  horizontally-scrolled table.
- A `layout="rows"` prop on `TicketList` forces the row pattern even at
  desktop width — use this for any *narrow* column context (e.g. a
  dashboard sidebar/preview list), not just for small screens. Width in
  pixels matters more than breakpoint name when a table is embedded in a
  constrained column rather than the full page.

## Things intentionally avoided (don't reintroduce)

- Floating stat cards with icon-in-circle + big number + caption, repeated
  in a grid — see `VitalsStrip` note above.
- Horizontal scroll on data tables.
- Full-bleed edge-to-edge progress/meter lines on list rows (reads as a
  divider) — meters are inset, rounded, with a visible track color.
- Decorative use of triage red/amber/blue/orange outside priority & SLA
  context.
- Bumping font sizes or padding up "for breathing room" instead of fixing
  structure — this app's density is deliberate.


## Dashboard pattern (user/requester role specifically)

The requester-facing dashboard (`src/app/dashboard/page.tsx`, `role === "user"`
branch) went through two wrong passes before landing here — both are worth
knowing so they aren't repeated:

1. First pass: reused `VitalsStrip` (4-cell KPI strip) as-is. Rejected — a
   boxed grid of big-number-over-caption cells, repeated for data that's
   mostly 0-3, is the generic "AI dashboard" look, whether rendered as
   separate cards or one bordered strip.
2. Second pass: removed the strip and the sidebar entirely, left a single
   bare line of text (`"3 open · 1 waiting"`) above a column capped at
   `max-w-[760px]` with nothing beside it. Also rejected — this fixed the
   "stat tile" problem but overcorrected into dead canvas: a tiny amount
   of content stranded in a mostly-empty page reads just as unfinished as
   the tile grid did, only quieter about it. **Removing a bad widget is
   not the same as finishing the design** — the freed space needs real
   content or the page still fails the "does this look professional"
   test.

What's actually in place now:

- **`StatusPanel`** — one bordered `Panel`, one row of icon + number +
  label groups separated by hairline vertical dividers (`border-l
  border-line`), not a grid of separate stat cells. Only non-zero facts
  render (no `0 waiting on your reply` clutter); icon + text color both
  carry the tone (ink-4/warn/urgent/ok) so it reads at a glance without
  needing a card background per item. This is the "bedside monitor read-
  out" idea applied as a single inline strip instead of a grid — keep that
  distinction: one Panel, one row, dividers not borders.
- **Two-column grid restored** (`lg:grid-cols-[minmax(0,1fr)_300px]`), same
  shape as the agent/admin dashboard, so the page uses the available width
  instead of pinning content to one side with a dead gutter.
- **Sidebar holds real, live content**, not filler: `RecentActivityPanel`
  (last 5 items from `/api/activity`, same data the full Activity page
  uses, just trimmed) and `ResponseTargetsPanel` (the SLA reference, as a
  compact `Panel` with a divided list — not a full table, but a proper
  card with a header, not an inline strip). Both panels are genuinely
  useful to a requester (what happened on my tickets; what should I expect)
  — don't replace either with a decorative/placeholder widget just to fill
  space, and don't add a third panel unless it carries equally real
  content.
- **No "By status" bar chart** on this role's dashboard — a distribution
  chart over 2-3 ticket statuses with mostly 0/1 counts is still noise
  dressed as analytics, independent of the layout question above. Keep
  `HBarList`/`By status` only on agent/admin, where volume makes a
  distribution meaningful.

The rule this leaves for next time: when removing a generic/bad pattern,
check what's left behind. If the fix produces a visibly quiet, lopsided, or
sparse page, that's not done — fill the freed space with real, role-
appropriate data (an existing API already provides most of what a
"meaningful" sidebar needs here), not more whitespace and not decorative
filler either.


## Glass material (v2)

- **Backdrop**: `body` paints a fixed, soft radial-gradient wash (teal/cyan,
  ~12-16% opacity) over `--color-canvas`, never a solid flat color anymore.
  Defined once in `globals.css`; nothing else should set its own page
  background.
- **`.glass`** (used by `Panel`, the default container everywhere): translucent
  white (`--color-glass`, 58% opacity) + `backdrop-filter: blur(20px)
  saturate(140%)` + a soft light border + a layered shadow
  (`--shadow-glass`, an inset highlight + an ambient drop shadow). This is
  the one card surface in the app — don't hand-roll another `bg-white/NN
  backdrop-blur` combination, use `.glass` or `.glass-strong`.
- **`.glass-strong`** (used by `Modal`): higher-opacity (78%) version for
  content that sits over other glass (dialogs, popovers) and needs more
  contrast against whatever is behind it.
- Buttons, inputs, and badges stay **solid**, not glass — small controls
  need full contrast/legibility, translucency is for the larger resting
  surfaces (panels, lists, dialogs), not things people read fine print or
  type into.
- Radii grew a step (`--radius-lg` 12→18px, `--radius-xl` 16→24px) to match
  the softer, more tactile glass material — bento tiles and Panel both use
  `rounded-xl`/`rounded-2xl` now, not `rounded-lg`.

## Bento grids (v2)

- **`VitalsStrip`** (`kpi.tsx`, used by agent/admin overviews, always 5
  fixed items): `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`, first tile
  `col-span-2`, the rest `col-span-1` — this exact combination is chosen so
  the grid **tiles perfectly with no empty trailing cells** at every
  breakpoint (2+1=3 on tablet, 2+1+1+1+1=6 on desktop). Don't change the
  column counts without re-checking that the spans still sum evenly.
- **`StatusPanel`** (`dashboard/page.tsx`, user role, variable 2-4 items):
  same idea, but since the item count varies, the wide-primary treatment
  only applies for 2-3 items (where it tiles perfectly: 2+2=4, 2+1+1=4); at
  4 items every tile is forced equal-width instead of wide-primary, because
  a wide first tile at n=4 leaves a half-empty trailing row — exactly the
  "AI slop / too much free space" failure this app was redesigned to avoid
  once already. **If you add a bento grid elsewhere, do the same
  arithmetic check before shipping — a bento grid that doesn't tile is
  worse than the plain strip it replaced.**
- Bento tiles get `motion-safe:hover:-translate-y-0.5` (transform only,
  compositor-friendly, respects `prefers-reduced-motion` via the
  `motion-safe:` variant) as the one shared micro-interaction — don't add
  a second, different hover treatment to a new tile type.