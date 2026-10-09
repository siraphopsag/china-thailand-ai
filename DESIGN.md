# C.A.L.L. design rules

The rules every page follows, so new screens look like the old ones. The values live in `src/index.css` (colour variables and
component classes) and `tailwind.config.js` (named sizes). Change a value there, not on one page.

Written after the pre-release QA review (Oct 2026). The owner's reference layouts come first: when a page follows one of his
references (the board cards, the menu capsule), keep that look and apply these rules around it.

## 1. Colour

- Every colour comes from a variable in `src/index.css`, with a light and a dark value. Never write a hex colour in a component.
  (The menu capsule's place colours in `sidenav.tsx` are the one exception, from the owner's reference.)
- Surfaces, from back to front: `page` → `surface` → `surface2` → `surface3`. Lines: `line` for dividers, `control` for the border
  of anything you can press or type into (3:1 or more against every surface).
- Text: `ink` for body text, `muted` for secondary text (4.5:1 or more on every surface). Never fade text with opacity.
- `primary` is the action colour. `brand` + `brandfg` is its light tint (chosen states, tinted buttons).
- Status: `ok`, `warn`, `danger`, `info`, `review`, each as `-bg`, `-fg` and `-line`. Never show a status by colour alone: add an
  icon or a word.
- The visitor can switch the accent colour in Settings: use `primary`, `brand` and `brandfg`, never a fixed indigo.

## 2. Emphasis (one main action per view)

| Level | Class | Use |
| --- | --- | --- |
| 1 | `btn-primary` | The one main action of a view (a page, a dialog, a panel). Only one solid button per view. |
| 2 | `btn-soft` | An action repeated on many cards or rows (e.g. "Apply" on every board card). |
| 3 | `btn-ghost` | Secondary actions: back, cancel, edit, filters. |
| 4 | Text link (`text-primary underline`) | Small actions inside text. |
| Danger | `btn-ghost text-danger-fg`, or a dialog with `danger` | Delete, withdraw, decline. Always ask in the site's dialog first. |

- Disabled buttons stay readable (grey plate, `muted` text). Say why a button is disabled next to it, or leave it enabled and
  explain on press.
- A chosen tab, pill or segment uses `seg-on` (tint, outline and bold text). Never fill it with solid `primary`: that colour
  belongs to the main button.
- Tabs (`role="tab"`): arrow keys move between them (`PanelTabs` in `match.tsx`, `TabBar` in `components/ui.tsx`).

## 3. Sizes

| Token | Value | Use |
| --- | --- | --- |
| `rounded-control` | 12 px (`rounded-xl`) | Buttons, fields, menus |
| `rounded-card` | 16 px (`rounded-2xl`) | Cards and panels (`.card`) |
| `rounded-panel` | 24 px | Large cards from the owner's references (`.bd-card`) |
| `rounded-full` | | Pills, segments, and the buttons in a row of pills |
| `min-h-control` | 40 px | Every button and field on a computer (`.btn`, `.input`) |
| `min-h-touch` | 44 px | Controls used mostly on phones: chips, list rows, menu items |

- Mixing in one row: buttons in one row share their shape. A row of pills makes its buttons `!rounded-full` too.
- Every button has a border (transparent when not drawn), so filled and outlined buttons are the same height.
- Text: `h1` (20–28 px, bold) once per page, `h2` (16–18 px, semibold) for sections, body 15–16 px, small text `text-xs` (12 px).
  Avoid 10–11 px except numbers in badges.
- Phones scale the whole interface to 93.75% of the visitor's own text size (`html` in `index.css`). Never set a fixed pixel size
  on `html`. Everything must still work at 200% text: rows wrap, nothing is cut to a few letters, and the page never scrolls
  sideways.

## 4. Layout

- Breakpoints: `sm` 640 px (tablet layout), `md` 768 px (the menu moves from the bottom bar to the left rail), `lg` 1024 px
  (two columns: map + steps), `fit` (1024 px wide and 600 px tall: app pages fit the screen, lists scroll inside).
- Phones keep 12 px side padding and room at the bottom for the menu bar (`pb-28` on `main`). Lists and pop-ups must stay above
  the bar (`ListSelect` measures it).
- Long pages are split into tabs (`PanelTabs`) instead of scrolling past several forms.

## 5. Forms

- Labels are always visible; required fields say "(required)" (`<Req />`); hints sit under the field, linked with
  `aria-describedby`.
- On submit, show **every** problem at once under its field (`useFieldError().setMany`), mark the fields (`aria-invalid`, which
  draws a red border), put a short summary at the top, and focus the first one. Fixing a field clears only its own message.
- Ask before anything that uses an allowance or cannot be undone (post, pin, renew, delete), show "saving…" on the button, then
  confirm what happened.

## 6. States

- Loading: a short line with `role="status"`. Empty: say why it is empty and offer the next step (`<Empty>` with an action).
- Errors: say what happened and what to do. A lost connection offers "Try again", never "clear your data"
  (`ErrorBoundary.tsx`).
- After an action removes the button that started it (a step changes, a dialog closes, a list item goes), move focus to the new
  step's heading or the result message. Focus must never fall back to the page.

## 7. Words

- Three languages (Thai, Chinese, English) for every visible text, in `src/locales/*`. Plain words, short sentences.
- One word per action across the site (e.g. "สมัครงาน / 申请 / Apply").
- Simulated content is always labelled "ข้อมูลจำลอง" (`SampleBadge`); demo accounts with `DemoBadge`.

## 8. Motion

- Short transitions (150–250 ms). Everything respects `prefers-reduced-motion`; the hero lines can also be stopped in Settings.
