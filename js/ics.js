/* llc — .ics import and export */
(function (global) {
  const S = global.LLCStore;
  const DAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const DAY_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  function unfold(text) {
    return String(text).replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  }

  function parseDateValue(prop, value) {
    const upper = (prop || "").toUpperCase();
    const isDate = /VALUE=DATE/.test(upper) || (/^\d{8}$/.test(value) && value.length === 8);
    if (isDate) {
      const y = +value.slice(0, 4), m = +value.slice(4, 6) - 1, d = +value.slice(6, 8);
      return { date: S.toDateStr(new Date(y, m, d)), time: "", allDay: true };
    }
    const compact = value.replace(/[-:]/g, "");
    const y = +compact.slice(0, 4), mo = +compact.slice(4, 6) - 1, d = +compact.slice(6, 8);
    const h = +compact.slice(9, 11) || 0, mi = +compact.slice(11, 13) || 0;
    let dt;
    if (/Z$/.test(value)) dt = new Date(Date.UTC(y, mo, d, h, mi, 0));
    else dt = new Date(y, mo, d, h, mi, 0);
    return { date: S.toDateStr(dt), time: S.pad(dt.getHours()) + ":" + S.pad(dt.getMinutes()), allDay: false };
  }

  function parseProps(block) {
    const props = {};
    block.split("\n").forEach((line) => {
      if (!line || line.charAt(0) === " ") return;
      const idx = line.indexOf(":");
      if (idx < 0) return;
      const keyPart = line.slice(0, idx);
      const value = line.slice(idx + 1).replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
      const name = keyPart.split(";")[0].toUpperCase();
      if (name === "EXDATE") {
        props.EXDATE = props.EXDATE || [];
        value.split(",").forEach((v) => {
          const p = parseDateValue(keyPart, v.trim());
          if (p.date) props.EXDATE.push(p.date);
        });
        return;
      }
      props[name] = { raw: keyPart, value: value };
    });
    return props;
  }

  function parseRRule(str) {
    if (!str) return null;
    const parts = {};
    str.split(";").forEach((bit) => {
      const [k, v] = bit.split("=");
      if (k) parts[k.toUpperCase()] = v;
    });
    const freq = (parts.FREQ || "").toUpperCase();
    if (!freq) return null;
    const rec = { freq: freq.toLowerCase(), days: [], until: "", skipDates: [] };
    if (parts.BYDAY) {
      rec.days = parts.BYDAY.split(",").map((d) => DAY_MAP[d.replace(/\d/g, "").toUpperCase()]).filter((n) => n !== undefined);
    }
    if (parts.UNTIL) {
      const u = parseDateValue("DTSTART", parts.UNTIL);
      rec.until = u.date;
    }
    if (rec.freq !== "weekly" && rec.freq !== "daily" && rec.freq !== "monthly") rec.freq = "weekly";
    return rec;
  }

  function parseICS(text) {
    const src = unfold(text);
    const events = [];
    const chunks = src.split(/BEGIN:VEVENT/i).slice(1);
    chunks.forEach((chunk) => {
      const body = chunk.split(/END:VEVENT/i)[0];
      const p = parseProps(body);
      if (!p.DTSTART) return;
      const start = parseDateValue(p.DTSTART.raw, p.DTSTART.value);
      let end = p.DTEND ? parseDateValue(p.DTEND.raw, p.DTEND.value) : null;
      if (end && start.allDay) {
        const endDate = S.parseDateStr(end.date);
        const adj = S.addDays(endDate, -1);
        if (adj >= S.parseDateStr(start.date)) end = { date: S.toDateStr(adj), time: "", allDay: true };
      }
      const rec = parseRRule(p.RRULE && p.RRULE.value);
      const skip = (p.EXDATE || []).slice();
      const ev = {
        id: S.uid(),
        title: (p.SUMMARY && p.SUMMARY.value) || "Imported event",
        categoryId: "cat-events",
        date: start.date,
        startTime: start.allDay ? "" : start.time,
        endTime: end && !end.allDay ? end.time : "",
        allDay: start.allDay,
        location: (p.LOCATION && p.LOCATION.value) || "",
        notes: (p.DESCRIPTION && p.DESCRIPTION.value) || "",
        recurrence: rec,
        skipDates: skip,
        reminderMinutes: null
      };
      if (rec && !rec.days.length && rec.freq === "weekly") {
        rec.days = [S.parseDateStr(start.date).getDay()];
      }
      if (rec && end && end.date > start.date && !rec.until) rec.until = end.date;
      events.push(ev);
    });
    return events;
  }

  function icsDate(dateStr, timeStr, allDay) {
    const compact = dateStr.replace(/-/g, "");
    if (allDay || !timeStr) return compact;
    return compact + "T" + timeStr.replace(":", "") + "00";
  }

  function untilIcs(dateStr) {
    return dateStr.replace(/-/g, "") + "T235959";
  }

  function escapeText(s) {
    return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }

  function vevent(lines) {
    return "BEGIN:VEVENT\n" + lines.join("\n") + "\nEND:VEVENT";
  }

  function fold(line) {
    if (line.length <= 75) return line;
    let out = line.slice(0, 75);
    let rest = line.slice(75);
    while (rest.length) {
      out += "\r\n " + rest.slice(0, 74);
      rest = rest.slice(74);
    }
    return out;
  }

  function eventLines(summary, date, startTime, endTime, allDay, location, notes, rrule, exdates, uid) {
    const lines = ["UID:" + uid, "DTSTAMP:" + icsDate(S.toDateStr(new Date()), S.pad(new Date().getHours()) + ":" + S.pad(new Date().getMinutes()))];
    if (allDay || !startTime) {
      lines.push("DTSTART;VALUE=DATE:" + icsDate(date, "", true));
      if (endTime || date) {
        const endD = endTime && /^\d{4}-\d{2}-\d{2}$/.test(endTime) ? endTime : date;
        const exclusive = S.toDateStr(S.addDays(S.parseDateStr(endD), 1));
        lines.push("DTEND;VALUE=DATE:" + icsDate(exclusive, "", true));
      }
    } else {
      lines.push("DTSTART:" + icsDate(date, startTime, false));
      lines.push("DTEND:" + icsDate(date, endTime || startTime, false));
    }
    lines.push("SUMMARY:" + escapeText(summary));
    if (location) lines.push("LOCATION:" + escapeText(location));
    if (notes) lines.push("DESCRIPTION:" + escapeText(notes));
    if (rrule) lines.push("RRULE:" + rrule);
    (exdates || []).forEach((d) => {
      lines.push(allDay || !startTime ? "EXDATE;VALUE=DATE:" + d.replace(/-/g, "") : "EXDATE:" + icsDate(d, startTime, false));
    });
    return lines.map(fold);
  }

  function byDay(days) {
    return (days || []).slice().sort().map((d) => DAY_ICS[d]).join(",");
  }

  function exportICS(state) {
    const chunks = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//llc//life tracker//EN", "CALSCALE:GREGORIAN"];
    (state.classes || []).forEach((cls) => {
      const rrule = "FREQ=WEEKLY;BYDAY=" + byDay(cls.days) + ";UNTIL=" + untilIcs(cls.endDate);
      chunks.push(vevent(eventLines(cls.name, cls.startDate, cls.startTime, cls.endTime, false, cls.location, cls.notes, rrule, cls.skipDates, cls.id + "@llc")));
    });
    const plan = state.gymPlan;
    if (plan && plan.assignments) {
      const days = Object.keys(plan.assignments).map(Number).filter((d) => plan.assignments[d] || plan.assignments[String(d)]);
      const start = plan.startDate || S.toDateStr(new Date());
      const until = plan.endDate ? ";UNTIL=" + untilIcs(plan.endDate) : "";
      days.forEach((d) => {
        const name = plan.assignments[d] || plan.assignments[String(d)];
        const rrule = "FREQ=WEEKLY;BYDAY=" + DAY_ICS[d] + until;
        chunks.push(vevent(eventLines(name + " (Gym)", start, plan.startTime || "17:00", plan.endTime || "18:30", false, plan.location, plan.notes, rrule, plan.skipDates, "gym-" + d + "@llc")));
      });
    }
    (state.events || []).forEach((ev) => {
      let rrule = null;
      if (ev.recurrence) {
        if (ev.recurrence.freq === "daily") rrule = "FREQ=DAILY";
        else if (ev.recurrence.freq === "monthly") rrule = "FREQ=MONTHLY";
        else rrule = "FREQ=WEEKLY;BYDAY=" + byDay(ev.recurrence.days && ev.recurrence.days.length ? ev.recurrence.days : [S.parseDateStr(ev.date).getDay()]);
        if (ev.recurrence.until) rrule += ";UNTIL=" + untilIcs(ev.recurrence.until);
      }
      const skips = [].concat(ev.skipDates || [], (ev.recurrence && ev.recurrence.skipDates) || []);
      chunks.push(vevent(eventLines(ev.title, ev.date, ev.startTime, ev.endTime, ev.allDay, ev.location, ev.notes, rrule, skips, ev.id + "@llc")));
    });
    (state.tasks || []).forEach((task) => {
      if (!task.dueDate) return;
      chunks.push(vevent(eventLines((task.done ? "[Done] " : "") + task.title, task.dueDate, task.dueTime || "", "", !task.dueTime, "", task.notes, null, [], task.id + "@llc")));
    });
    chunks.push("END:VCALENDAR");
    return chunks.join("\r\n") + "\r\n";
  }

  global.LLCIcs = { parseICS, exportICS };
})(window);
