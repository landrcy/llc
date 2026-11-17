# llc

A personal life tracker for school, gym, events, personal items, and homework. It is a static site — everything is stored in your browser (`localStorage`).

Live site: https://landrcy.github.io/llc/

## What’s included

- Home hub with calendar, school, gym, events, and personal
- Calendar with Month, Week, and Day views (week/day default to 7:30 AM–10:30 PM)
- Side panel: Happening now / Next up, Today, and This week
- Categories: School, Gym, Events, Personal
- Recurring classes and events, skip dates, class semester setup
- Gym weekly planner: Push / Pull / Legs plus an optional bonus day, weekdays only
- Homework tracker (due date, class, title, done) — due items show as school-colored bars
- Gym workout log with per-exercise history
- Dark theme, Times New Roman

## Preloaded schedule

Broward College classes are already on the calendar (times are approximate and editable). Gym sessions and homework are not preloaded. Spring 2027 classes stay in the data but stay out of the agenda and side panel until January 1, 2027; they still appear if you open January or later on the calendar.

**Fall 2026:** August 21, 2026 – December 15, 2026. Day classes skip Thanksgiving (**Nov 25–29**). Also marked: Thanksgiving break (all day, Nov 25–29) and Fall finals week (Dec 9–15).

**Spring 2027 Session I:** January 6, 2027 – May 4, 2027. Skipped for day classes: MLK Day (**Jan 18**), Professional Development Day (**Feb 19**, no day classes; evening classes from 5 p.m. still meet), Spring Break (**Mar 1–7**). The college PDF lists the last regular class day as Apr 27 and finals week as Apr 28–May 4; this site uses May 4 so finals week stays on the calendar.

## Running locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080
