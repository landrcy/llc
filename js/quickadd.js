/* llc — natural-language quick-add parser (no dependencies) */
(function (root) {
  const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const WEEKDAY_ALIAS = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6
  };
  const MONTH_ALIAS = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, sept: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
  };
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const CAT_NAME = { "cat-gym": "Gym", "cat-classes": "School", "cat-personal": "Personal", "cat-events": "Events" };
  const STRUCTURAL = /^(gym|workout|workouts|homework|hw|due|assignment|assignments)$/i;
  const GYM_TYPE = { push: "Push", pull: "Pull", legs: "Legs", bonus: "Bonus" };

  function pad(n) { return String(n).padStart(2, "0"); }

  function toDateStr(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function toHM(mins) {
    const m = ((mins % (24 * 60)) + (24 * 60)) % (24 * 60);
    return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  }

  function parseMeridiem(s) {
    if (!s) return null;
    const t = s.replace(/\./g, "").toLowerCase();
    if (t === "am" || t === "a") return "am";
    if (t === "pm" || t === "p") return "pm";
    return null;
  }

  function parseClock(raw, fallbackMer) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase().replace(/\s+/g, "");
    if (s === "noon") return 12 * 60;
    if (s === "midnight") return 0;
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?(?:(a\.?m\.?|p\.?m\.?|am|pm|a|p))?$/i);
    if (!m) return null;
    let h = Number(m[1]);
    const min = m[2] != null ? Number(m[2]) : 0;
    if (min > 59) return null;
    const mer = parseMeridiem(m[3]) || fallbackMer;
    if (mer) {
      if (h > 12) return null;
      if (mer === "am") {
        if (h === 12) h = 0;
      } else {
        if (h !== 12) h += 12;
      }
    } else if (h <= 24) {
      /* bare clock: 13–23 is 24h; 1–6 is PM; 7–11 is AM; 12 is noon */
      if (h === 24 && min === 0) return 0;
      if (h > 24) return null;
      if (h <= 12) {
        if (h === 12) h = 12;
        else if (h <= 6) h += 12;
      }
    } else return null;
    if (h === 24) h = 0;
    if (h > 23) return null;
    return h * 60 + min;
  }

  function fmtTime(hm) {
    const [h, m] = hm.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = (h % 12) || 12;
    return h12 + ":" + pad(m || 0) + " " + ap;
  }

  function fmtRange(start, end) {
    if (!start && !end) return "All day";
    if (!end || start === end) return fmtTime(start);
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const sap = sh >= 12 ? "PM" : "AM";
    const eap = eh >= 12 ? "PM" : "AM";
    const s12 = (sh % 12) || 12;
    const e12 = (eh % 12) || 12;
    const sCore = s12 + ":" + pad(sm || 0);
    const eCore = e12 + ":" + pad(em || 0);
    if (sap === eap) return sCore + "–" + eCore + " " + eap;
    return sCore + " " + sap + " – " + eCore + " " + eap;
  }

  function fmtPreview(date, start, end, categoryName, kind) {
    const d = date instanceof Date ? date : (function () {
      const [y, m, day] = date.split("-").map(Number);
      return new Date(y, m - 1, day);
    })();
    const when = WEEKDAYS_SHORT[d.getDay()] + ", " + MONTHS_SHORT[d.getMonth()] + " " + d.getDate();
    const time = kind === "task" && start && (!end || end === start)
      ? fmtTime(start)
      : fmtRange(start, end);
    return when + " · " + time + " · " + categoryName;
  }

  function nextWeekday(now, dow) {
    const cur = now.getDay();
    const ahead = (dow - cur + 7) % 7;
    return addDays(startOfDay(now), ahead);
  }

  function resolveMonthDay(now, month, day, year) {
    const y = year != null ? year : now.getFullYear();
    const d = new Date(y, month, day);
    if (d.getMonth() !== month || d.getDate() !== day) return null;
    if (year == null && d < startOfDay(now)) return new Date(y + 1, month, day);
    return d;
  }

  function extract(text) {
    const marks = [];
    function take(re, fn) {
      const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      let m;
      const s = text;
      while ((m = r.exec(s))) {
        if (fn(m) !== false) marks.push([m.index, m.index + m[0].length]);
      }
    }
    return { take: take, marks: marks };
  }

  function blankOut(s, marks) {
    const chars = s.split("");
    marks.forEach(function (span) {
      for (let i = span[0]; i < span[1] && i < chars.length; i++) {
        if (!/\s/.test(chars[i])) chars[i] = " ";
      }
    });
    return chars.join("").replace(/[.,;:!]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function parse(text, now) {
    now = now ? new Date(now) : new Date();
    const raw = String(text == null ? "" : text).trim();
    const empty = {
      ok: false, title: "", date: toDateStr(now), startTime: "", endTime: "", allDay: true,
      categoryId: "cat-events", categoryName: "Events", kind: "event", gymSession: null,
      preview: "Type something like “gym push wed 5pm”", raw: raw
    };
    if (!raw) return empty;

    const marks = [];
    function cut(index, length) { marks.push([index, index + length]); }

    let startMin = null, endMin = null;
    const timeRange = /\b(?:(?:at|from)\s+)?(noon|midnight|\d{1,2}(?::\d{2})?\s*(?:[ap](?:\.?m\.?)?)?)\s*(?:-|–|—|to)\s*(noon|midnight|\d{1,2}(?::\d{2})?\s*(?:[ap](?:\.?m\.?)?)?)\b/ig;
    let m;
    while ((m = timeRange.exec(raw))) {
      const merEnd = (m[2].match(/[ap](?:\.?m\.?)?/i) || [])[0];
      const merStart = (m[1].match(/[ap](?:\.?m\.?)?/i) || [])[0];
      const mer = parseMeridiem(merEnd) || parseMeridiem(merStart);
      const a = parseClock(m[1], mer);
      const b = parseClock(m[2], mer);
      if (a == null || b == null) continue;
      startMin = a;
      endMin = b;
      if (endMin <= startMin && !parseMeridiem(merEnd) && mer === "am") {
        /* ignore wrap quirks */
      }
      cut(m.index, m[0].length);
      break;
    }

    if (startMin == null) {
      const timeOne = /\b(?:at\s+)?(noon|midnight|\d{1,2}(?::\d{2})?\s*[ap](?:\.?m\.?)?|\d{1,2}:\d{2})\b/ig;
      while ((m = timeOne.exec(raw))) {
        const a = parseClock(m[1], null);
        if (a == null) continue;
        startMin = a;
        cut(m.index, m[0].length);
        break;
      }
    }

    /* Bare hour like "2pm" already handled; also "5pm" with space already in regex. */
    if (startMin == null) {
      const loose = /\b(?:at\s+)?(\d{1,2})\s*([ap](?:\.?m\.?)?)\b/ig;
      while ((m = loose.exec(raw))) {
        const a = parseClock(m[1] + m[2], null);
        if (a == null) continue;
        startMin = a;
        cut(m.index, m[0].length);
        break;
      }
    }

    let date = null;
    const rel = /\b(today|tonight|tomorrow|tommorow)\b/ig;
    while ((m = rel.exec(raw))) {
      const w = m[1].toLowerCase();
      date = /tomorrow|tommorow/.test(w) ? addDays(startOfDay(now), 1) : startOfDay(now);
      cut(m.index, m[0].length);
      break;
    }

    if (!date) {
      const wd = /\b(?:(next)\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)\b/ig;
      while ((m = wd.exec(raw))) {
        const dow = WEEKDAY_ALIAS[m[2].toLowerCase()];
        if (dow == null) continue;
        date = nextWeekday(now, dow);
        if (m[1] && date.getDay() === now.getDay()) date = addDays(date, 7);
        else if (m[1] && date.getTime() === startOfDay(now).getTime()) date = addDays(date, 7);
        cut(m.index, m[0].length);
        break;
      }
    }

    if (!date) {
      const md = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/ig;
      while ((m = md.exec(raw))) {
        const month = MONTH_ALIAS[m[1].toLowerCase()];
        const day = Number(m[2]);
        const year = m[3] ? Number(m[3]) : null;
        const d = resolveMonthDay(now, month, day, year);
        if (!d) continue;
        date = d;
        cut(m.index, m[0].length);
        break;
      }
    }

    if (!date) {
      const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
      while ((m = iso.exec(raw))) {
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (d.getMonth() !== Number(m[2]) - 1) continue;
        date = d;
        cut(m.index, m[0].length);
        break;
      }
    }

    if (!date) {
      const slash = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g;
      while ((m = slash.exec(raw))) {
        const month = Number(m[1]) - 1;
        const day = Number(m[2]);
        let year = m[3] ? Number(m[3]) : null;
        if (year != null && year < 100) year += 2000;
        const d = resolveMonthDay(now, month, day, year);
        if (!d) continue;
        date = d;
        cut(m.index, m[0].length);
        break;
      }
    }

    if (!date) date = startOfDay(now);

    const lower = raw.toLowerCase();
    let kind = "event";
    let categoryId = "cat-events";
    let gymSession = null;

    const gymTypeHit = lower.match(/\b(push|pull|legs|bonus)\b/);
    const gymHit = /\b(gym|workout|workouts)\b/.test(lower);
    const dueHit = /\bdue\b/.test(lower);
    const hwHit = /\b(homework|hw|essay|assignment|assignments|quiz|test|exam)\b/.test(lower);
    const personalHit = lower.match(/\b(dentist|doctor|doctors|haircut|haircut|call)\b/);

    if (gymHit || gymTypeHit) {
      kind = "gym";
      categoryId = "cat-gym";
      gymSession = gymTypeHit ? GYM_TYPE[gymTypeHit[1]] : "Push";
    } else if (dueHit || hwHit) {
      kind = "task";
      categoryId = "cat-classes";
    } else if (personalHit) {
      kind = "event";
      categoryId = "cat-personal";
    }

    /* Mark structural category words for removal from the title, but keep descriptive ones (quiz, essay, dentist). */
    const structRe = /\b(gym|workout|workouts|homework|hw|due|assignment|assignments)\b/ig;
    while ((m = structRe.exec(raw))) cut(m.index, m[0].length);
    if (kind === "gym") {
      const typ = /\b(push|pull|legs|bonus)\b/ig;
      while ((m = typ.exec(raw))) cut(m.index, m[0].length);
    }

    let title = blankOut(raw, marks);
    if (!title) {
      if (kind === "gym") title = gymSession || "Gym";
      else if (kind === "task") title = "Homework";
      else title = "Event";
    }

    let startTime = "";
    let endTime = "";
    let allDay = false;
    if (startMin != null) {
      startTime = toHM(startMin);
      if (kind === "task" && dueHit && endMin == null) {
        endTime = startTime;
      } else if (endMin != null) {
        endTime = toHM(endMin);
      } else {
        const plus = startMin + 60;
        endTime = plus >= 24 * 60 ? "23:59" : toHM(plus);
      }
    } else {
      allDay = kind !== "gym";
    }

    const categoryName = CAT_NAME[categoryId] || "Events";
    const preview = fmtPreview(date, startTime, endTime, categoryName, kind);

    return {
      ok: true,
      title: title,
      date: toDateStr(date),
      startTime: startTime,
      endTime: endTime,
      allDay: allDay,
      categoryId: categoryId,
      categoryName: categoryName,
      kind: kind,
      gymSession: gymSession,
      preview: preview,
      raw: raw
    };
  }

  const api = { parse: parse, fmtPreview: fmtPreview, fmtRange: fmtRange };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LLCQuickAdd = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
