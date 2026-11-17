# llc — overnight refinement log

## Nov 17, 2026 — pass #1 (12 AM ET)

**Verified already in place:** red current-time line, all-day row at the top of week/day, short items on one line, white bold titles with the time on a second line, "Next up" showing the weekday and date when the item isn't today, dark theme only, Times New Roman, molecule home hub, gym planner (Push/Pull/Legs + Bonus, weekdays only), empty homework tracker, Spring 2027 hidden from lists until Jan 1, Fall 2026 ending Dec 15 and skipping Nov 25–29.

**Fixed / finished:**
- Classes bar: each day's classes now fold into one filled "Classes" bar (first start → last end) in month, week and day views and in the side panel. Click it to see the individual classes; click it again (or the thin rail next to them in week/day) to fold them back up. Expand/collapse uses a springy transform/opacity animation.
- Colored dots are gone everywhere: month items, side panel and list rows, and the category filters are now filled rounded pills with white text.
- Google Calendar-style blocks: rounded 6px, text anchored to the top, thin all-day bars, no squashed text on short blocks.
- Minimalist strip: removed .ics/JSON import/export (inputs, handlers, script tag), reminder fields and the notification code, the "Built-in" labels, the explanatory onboarding/empty-state copy, and the wordy panel headings ("Next up", "This week").
- Mobile (390px): week/day views were collapsing to 0px height. The board now fills the screen (7:30 AM–10:30 PM, no vertical scroll), the topbar fits on one line, and the week view fits all 7 days with no sideways scroll.
- The 8 AM and 10 PM gutter labels show again; labels sit centred on short tick marks.

**Added (Structured-style live "now"):**
- The "Now" item in the side panel fills up as time passes and shows "35 min left · ends 12:15 PM". Today's "Next up" shows a countdown ("in 40 min · …").
- The red now-line and the side panel refresh every minute (and when the tab comes back into focus).

**Tested:** headless Chromium at 1280×800, 1920×1080 and 390×844. No console errors, no horizontal overflow, day view fits 7:30 AM–10:30 PM with no scrolling, and classes expand and collapse correctly in month, week, day and the side panel. No storage-shape change, so saved data is untouched.

## Nov 17, 2026 — pass #2 (2 AM ET)

Re-checked first: the live site loaded (200) with no console errors.

**Looked at:** Google Calendar, Apple Calendar, Fantastical, Notion Calendar (Cron), Amie, Structured and Things. What they share: you can drive them from the keyboard, a mini month lets you jump to any date, and the grid slides in the direction you're moving. All three fit llc's minimal look without adding anything to the screen.

**Added:**
- **Mini month date picker.** The date in the top bar (e.g. "November 15–21, 2026") is now a button. It opens a small dark month. Today is the gold circle and the week or day you're looking at is shaded. Use ‹ › to change months and tap a date to jump there; the current view (month, week or day) stays the same. Esc, or a click anywhere else, closes it. On phones the top bar shows a short "Nov" in the space the title used to leave empty, so the date picker works on mobile too.
- **Keyboard shortcuts** (the same keys as Google Calendar and Notion Calendar): T today · M / W / D views (1 / 2 / 3 still work) · ← / → or K / J (and the old P / N) for previous / next · G go to date · C add · Esc close the picker. Shortcuts are ignored while you're typing in a field, while a dialog is open, or when Ctrl, Cmd or Alt is held. Arrow keys now only move the calendar while you're on the calendar page. The buttons show the keys on hover ("Today (T)").
- **Smooth transitions.** Moving forward slides the new day, week or month in from the right, and moving back slides it in from the left. Switching between Month, Week and Day uses a soft fade and scale. The animations are 0.3–0.4 s, turn off under "reduce motion", and don't run on the once-a-minute now-line refresh or when classes expand or collapse.
- Small fix: going to the next or previous month from the 31st no longer skips a month (Jan 31 → Feb 28, not Mar 3).

**Tested:** headless Chromium at 1280×800, 1920×1080 and 390×844. No console errors, no horizontal overflow (including mid-slide), nothing in the top bar clipped, and day view fits 7:30 AM–10:30 PM with no scrolling. Every shortcut moves to the right period and direction; the picker opens, changes months, jumps and closes. Classes expand and collapse in month, week, day and the side panel, and the home molecule hub still opens the calendar. No storage changes, so saved data is untouched.

## Nov 17, 2026 — pass #3 (4 AM ET)

Re-checked first: the live site loaded (200) with no console errors; the picker and shortcuts worked.

**Ideas taken from:** Google Calendar and Notion Calendar (a small preview card when you click an event), Things (homework grouped by when it's due), and Structured/Fitbod-style week rings (a row showing the gym week at a glance).

**Added:**
- **Event preview popover.** On desktop, clicking a block or pill in month, week or day view opens a small card next to it instead of the full dialog. It shows a colour swatch, the title, the date and time, the category and location, and notes (up to 4 lines). It has the same quick actions as before: Skip this day / Edit class, Skip / Log workout, Skip / Edit event, and Mark done / Edit for homework. The card flips to the left when there's no room on the right, stays on screen, and highlights the block you clicked with a thin ring. Esc, a click elsewhere, scrolling, resizing, changing period or view, or clicking the same block again closes it. It opens with a springy scale/fade (turned off under reduced motion) and stays open through the once-a-minute now-line refresh. Phones/touch and the side panel still open the full dialog.
- **Gym week at a glance.** Four chips sit under the week header: Push / Pull / Legs / Bonus. Each chip shows the planned day (and time, if set), "Today", or "Not set". A chip turns solid with a check only when a workout is actually logged on that day; nothing is ever marked done automatically. Tapping a planned chip opens that slot's editor. The summary now reads "2/3 planned (+bonus) · 1 done". On phones the chips form a 2×2 grid.
- **Homework grouped by due date.** Overdue (red), Today, Tomorrow, Next 7 days, Later, No due date and Done (under All), each with a count. Items are sorted by due date and time. Today and Tomorrow show only the time. The list still starts empty, and the filters (Open / Overdue / Done / All) work the same as before.

**Polish:** A homework due time outside the 7:30 AM–10:30 PM window (e.g. 11:59 PM) used to stretch the whole week/day grid to midnight and get cut off at the bottom. It's now pinned inside the window and still labelled with its real time ("Lab report, 11:59pm"), so the grid stays 7:30 AM–10:30 PM.

**Tested:** headless Chromium at 1280×800, 1920×1080 and 390×844, with and without sample homework/gym data. No console errors and no horizontal overflow. Day and week fit 7:30 AM–10:30 PM with no scrolling. The popover opens, flips, closes (Esc, outside click, arrow keys) and its actions work (Edit class opens the dialog; Mark done toggles). Classes expand and collapse, the picker and all shortcuts still work, and the home hub opens the calendar. No storage-shape changes, so saved data is untouched.

## Nov 17, 2026 — pass #4 (6 AM ET)

Re-checked first: the live site loaded (200) with no console errors.

**Ideas taken from:** Google Calendar and Apple Calendar (finished events fade back), Google Calendar and Notion Calendar (a hover outline showing where a click will add something), and Fantastical/Structured (what's on now, visible at a glance without opening the app).

**Added:**
- **Finished items fade back.** Blocks and pills that have already ended (in month, week and day, including all-day items from earlier days) now use a softer, darker version of their colour with slightly dimmer white text, so what's still ahead stands out. They stay filled and rounded, Google Calendar-style. Open homework is never faded, even when it's overdue. Updates with the once-a-minute refresh.
- **Hover slot in week/day.** On desktop, moving the mouse over empty space in the week or day grid shows a faint dashed 1-hour outline with its start time ("7:45pm"), snapped to 15 minutes. Clicking there opens Add event already set to that day and time (this click-to-add already existed; now you can see where it will land). It glides with a springy transform/fade, stays inside the 7:30 AM–10:30 PM frame, hides over events, when the mouse leaves, or while a dialog or preview is open, and doesn't move under reduced motion. Phones/touch don't show it.
- **Live browser tab title.** The tab now reads "AMH2010 · 55 min left — llc" while something is on, "College Algebra in 2 hr 40 min — llc" when the next thing today is coming up, and just "llc" otherwise. It updates every minute, even when the tab is in the background. Homework and all-day items are left out.

**Tested:** headless Chromium at 1280×800, 1920×1080 and 390×844 (70 checks, all passing). No console errors and no horizontal overflow in month, week or day; nothing in the top bar clipped. Day and week fit 7:30 AM–10:30 PM with no scrolling. The hover slot appears, stays in its column, hides on leave, and clicking opens Add event at the shown time. Classes expand and collapse, the popover opens and closes, the picker and shortcuts (J / T) still work, and the home hub has its five icon circles and opens the calendar. Reduced motion turns off the slot's movement. No storage changes, so saved data is untouched.

## Nov 17, 2026 — morning: month grid fits the screen

- **Month view fills the window.** Week rows now share the leftover viewport height (`grid-template-rows: auto repeat(N, minmax(0, 1fr))`), with only as many rows as the month needs (4–6). The last week is no longer clipped. Desktop calendar pages do not scroll vertically.
- Cells clip leftover pills and show a **+N more** link when a day has more than fits.
- **Home** was removed from the sidebar. The **llc** title still opens the home hub, with a pointer cursor and a light fade on hover. Esc, keyboard shortcuts, and the mobile menu are unchanged.
- The browser tab title stays **llc**. The live countdown in the tab ("AMH2010 · 55 min left") was removed; the favicon is unchanged.

**Tested:** headless Chromium at 1280×800, 1920×1080, 1366×768 and 390×844, on November 2026 (5 rows) and a 6-row month. The last row's bottom edge stays inside the viewport, with no console errors. No storage changes, so saved data is untouched.

## Nov 17, 2026 — morning: no-school days

- Weekdays with no classes (Thanksgiving, skipped holidays, and days after the fall term ends on Dec 15) now stand out in a soft events-green tint with a light hatch, plus a "No school" label. If a break event is already on that day, it becomes one pill, e.g. "No school · Thanksgiving".
- Week view tints the column and puts a small "No school" tag in the header (a short "Off" on phones). Day view shows a "No school" banner under the date. If today is a no-school weekday, the side panel says "No school today".
- Weekends stay visually quiet, with only a very light muted tint, so the weekday days off are what you notice. School being hidden in the filters does not mark every weekday as off.

**Tested:** headless Chromium at 1280×800, 1920×1080 and 390×844. November's last week still fits on screen, day view still fits 7:30 AM–10:30 PM with no scrolling, and there were no console errors. No storage changes, so saved data is untouched.
