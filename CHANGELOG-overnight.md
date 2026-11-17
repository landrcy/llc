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
