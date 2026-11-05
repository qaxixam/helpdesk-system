# Agent instructions — MedOps Helpdesk

This file is for any AI agent (Claude or otherwise) working on this codebase.
Read this fully before touching UI code. It exists because earlier work on
this project shipped a "fix" that was never actually looked at — padding was
tweaked blind and the result was worse than the original. Don't repeat that.

## Before you start

1. **Read `DESIGN.md`** in this same folder. It documents the actual design
   system (colors, type scale, spacing, component inventory) extracted from
   the codebase. Do not re-derive these from memory or guess new values —
   use what's documented, and update the doc if you deliberately change
   something durable.
2. **Find the real component**, don't assume. Before editing a screen, grep
   for the page file under `src/app/**/page.tsx` and the components it
   imports from `src/components/`. Read the whole file, not a snippet.
3. **Check `globals.css`** (`src/app/globals.css`) for the token list
   (`--color-*`, `--radius-*`, `--shadow-*`) before inventing a new color or
   shadow. If what you need isn't there, add it to `@theme` and document it
   in `DESIGN.md` — don't hardcode a raw hex in a component.

## Required workflow for any visual/UI change

This is not optional. "I edited the JSX and it should look right" is not a
verification step — it has been wrong before.

1. **Make the change** with Edit (not a shell command) to the real file in
   the connected folder (`D:\help-desk\...`, reached through
   `mcp__remote-devices__device_bash`, never the container's own `Read`/
   `Edit`/`Bash` tools directly on that path — those operate on an unrelated
   path and the user never sees the result).
2. **Run `tsc --noEmit`** after any `.tsx`/`.ts` edit:
   `node ./node_modules/typescript/lib/tsc.js --noEmit` from the project
   root on-device. Fix errors before moving on.
3. **Actually render it and look.** This project's own Tailwind v4 install
   (`node_modules/tailwindcss`) can compile real project CSS against a
   throwaway HTML mock without npm network access (the container has no
   outbound DNS for npm). The working recipe used in this session:
   - Build a small static HTML file reproducing the exact classes you just
     wrote (copy the JSX structure, swap React syntax for plain HTML).
   - Compile it on-device with `tailwindcss/dist/lib.mjs`'s `compile()`,
     scanning the mock's `class="..."` attributes for candidates, against
     `src/app/globals.css` as the entry stylesheet. See the shell history
     in this session for the exact script if you need to recreate it.
   - Transfer the compiled CSS back to the container (device folders
     outside the user's connected folder, like a scratch `~/preview/`, are
     not stage-able — gzip+base64 through `device_bash`/cat heredoc, or
     keep the mock *inside* the connected folder temporarily and
     `device_stage_files` it).
   - Screenshot with Playwright (pre-installed in the container) at
     **multiple widths**: 360 (small phone), 430 (phone / narrow dashboard
     column), 768 (tablet / md breakpoint), 1024+ (desktop). Check
     `document.documentElement.scrollWidth > clientWidth` programmatically
     to catch horizontal overflow — don't eyeball it only.
   - **Read the screenshot with the `Read` tool and look at it.** If
     something reads as cramped, misaligned, or like a divider when it
     should be a meter (an actual mistake made and caught this session),
     fix it and re-render. Don't ship the first pass.
   - Delete the scratch preview folder when done.
4. Only after you've seen a passing screenshot at several widths do you
   tell the user it's fixed. Describe what you *saw*, not what you intended.

## What "polish" means here — and what it doesn't

- Do **not** fix a layout problem by shrinking padding/margins/font-sizes
  uniformly. That's not a redesign, it's compression, and it reads as
  worse, not better (this happened once already on the Open Tickets table —
  don't do it again). If a layout is wrong, change the *structure*: pick a
  different component pattern (e.g. a table that doesn't fit at a given
  width probably shouldn't be a table at that width — see `TicketRows` vs
  the `<table>` layout in `ticket-list.tsx` for the pattern already in use).
- Do **not** add a floating "stat card" grid with an icon-in-a-circle, a
  big number, and a muted caption, repeated 4+ times with heavy shadows and
  rounded-2xl corners. That is the generic "AI dashboard" look the user has
  explicitly called out as unwanted ("AI slop"). This codebase already
  rejected that pattern once — see `VitalsStrip` in `kpi.tsx`, which uses a
  single bordered strip with hairline dividers between cells (a "bedside
  monitor" read-out), not separate cards. Keep using that pattern, don't
  regress to floating cards.
- Watch for **dead whitespace from grid/flex mismatches between unrelated
  blocks** — e.g. a short vitals strip sitting above a two-column grid
  where one column (a form, a short list) is much shorter than the other,
  leaving a long blank gutter. Don't just leave it; either make the shorter
  column fill the space meaningfully (more detail, not padding) or change
  the grid so both columns correspond to content of similar length.
- **Removing a bad pattern is not the same as finishing the design.** This
  happened on the user dashboard: a generic 4-cell KPI strip was correctly
  identified as "AI slop" and removed, but the fix was a bare line of text
  dropped into an otherwise empty page — which the user then (correctly)
  called out as the same problem, just quieter. When you delete a widget
  because it's generic, check what the page looks like afterward, not just
  whether the bad thing is gone. If what's left reads as sparse or
  lopsided, either the freed space needs real content (check what data is
  already available via existing API routes/components before inventing
  something) or the surrounding layout needs to change shape to match the
  content that's actually there — don't ship "less bad" as if it were
  "good."

## What NOT to do

- Don't touch `AGENTS.md` (plural) — it's auto-generated by `next dev` on
  every run (see its own header comment) and will be silently overwritten.
  This file (`AGENT.md`, singular) and `DESIGN.md` are the durable ones.
- Don't invent new colors outside the `@theme` tokens in `globals.css`.
  Triage colors (urgent/high/medium/low) are reserved for priority & SLA
  signaling only — never reuse them as decorative accent colors elsewhere.
- Don't add `overflow-x-auto` to a table as a "fix" for it not fitting —
  that hides the real problem (see git history / this session's earlier
  mistake). Fix column sizing or switch layouts at the breakpoint instead.
- Don't run `npm install` expecting network access inside the cloud
  container — there is no outbound DNS to npm's registry there. Anything
  needed must already be in `node_modules` (it almost always is; this repo
  already has `tailwindcss`, `typescript`, `playwright` equivalents
  available). If you must install something, note it for the user to run
  on their own machine via `device_bash`, where the project's own `npm`
  does have network access.
- Don't claim a device-side edit is "already on the user's computer" and
  move on without confirming the tool call targeted the real
  `D:\help-desk\...` path through `mcp__remote-devices__device_bash` — the
  container's own `Read`/`Write`/`Edit`/`Bash` tools silently no-op against
  an unrelated path when given a Windows path.
- Don't batch unrelated UI changes into one unreviewed pass. Work one
  screen/section at a time, verify it (see workflow above), then move to
  the next. The user asked for the dashboard specifically — don't also
  "improve" unrelated screens unless asked.

## Reporting back to the user

- Say what changed in plain terms (Urdu/English mix is fine, mirror the
  user's own language — see their stated preference), not a diff dump.
- If you verified visually, say so briefly and specifically ("checked at
  phone and tablet width, no overflow") rather than a generic "looks
  good now."
- If something couldn't be verified (e.g. a flow that needs real auth/DB
  state you don't have), say that plainly instead of implying it was
  checked.
