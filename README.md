# llc

A personal life tracker for classes, gym, events, and tasks. It is a static site — everything is stored in your browser (`localStorage`). Export a JSON backup if you switch devices.

Live site: https://landrcy.github.io/llc/

## What’s included

- Calendar with Month, Week, and Day views
- Side panel: Happening now / Next up, Today, and This week / upcoming soon
- Categories: Classes, Gym, Events, Personal (plus any you add)
- Recurring events, skip dates, class semester setup, gym weekly splits
- Assignment list tied to classes (due dates show on the calendar)
- Gym workout log with per-exercise history
- Import/export JSON backups and `.ics` calendars
- Optional silent browser reminders while the tab is open
- Dark theme by default, light theme toggle, Times New Roman

## Preloaded schedule

Spring 2027 Session I at Broward College is already on the calendar (times are approximate and editable):

- Term: **January 6, 2027 – May 4, 2027**
- Skipped for day classes: MLK Day (**Jan 18**), Professional Development Day (**Feb 19**, no day classes; evening classes from 5 p.m. still meet), Spring Break (**Mar 1–7**)
- The college PDF lists the last regular class day as Apr 27 and finals week as Apr 28–May 4. The term end (and catalog “classes end”) is May 4, which is what this site uses so finals week stays on the calendar.

## Running locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080
