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
