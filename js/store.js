/* llc data layer — localStorage only */
(function (global) {
  const KEY = "llc-data-v1";
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function pad(n) { return String(n).padStart(2, "0"); }

  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function toDateStr(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function parseDateStr(s) {
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    return x;
  }

  function startOfWeek(d) {
    const x = startOfDay(d);
    x.setDate(x.getDate() - x.getDay());
    return x;
  }

  function endOfWeek(d) {
    return addDays(startOfWeek(d), 6);
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function daysInMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  function minutesSinceMidnight(hhmm) {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function formatTime(hhmm) {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = (h % 12) || 12;
    return h12 + ":" + pad(m || 0) + " " + ap;
  }

  function formatTimeCompact(hhmm) {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const h12 = (h % 12) || 12;
    return h12 + ":" + pad(m || 0);
  }

  function formatTimeRangeCompact(start, end) {
    if (!start) return "All day";
    if (!end) return formatTimeCompact(start);
    return formatTimeCompact(start) + "–" + formatTimeCompact(end);
  }

  function formatDateNice(sOrDate) {
    const d = typeof sOrDate === "string" ? parseDateStr(sOrDate) : sOrDate;
    return WEEKDAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
  }

  function formatGCalTime(hhmm) {
    if (!hhmm) return "";
    const parts = hhmm.split(":").map(Number);
    const h = parts[0], m = parts[1] || 0;
    const ap = h >= 12 ? "pm" : "am";
    const h12 = (h % 12) || 12;
    return m ? h12 + ":" + pad(m) + ap : h12 + ap;
  }

  function formatGCalRange(start, end) {
    if (!start) return "All day";
    if (!end) return formatGCalTime(start);
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const sap = sh >= 12 ? "pm" : "am";
    const eap = eh >= 12 ? "pm" : "am";
    const s12 = (sh % 12) || 12;
    const e12 = (eh % 12) || 12;
    const sCore = sm ? s12 + ":" + pad(sm) : String(s12);
    const eCore = em ? e12 + ":" + pad(em) : String(e12);
    if (sap === eap) return sCore + " – " + eCore + eap;
    return sCore + sap + " – " + eCore + eap;
  }

  function startOfGymWeek(d) {
    const x = startOfDay(typeof d === "string" ? parseDateStr(d) : d);
    const day = x.getDay();
    const off = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + off);
    return x;
  }

  function combine(dateStr, timeStr) {
    const d = parseDateStr(dateStr);
    const mins = minutesSinceMidnight(timeStr || "00:00");
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d;
  }

  function eachDate(start, end, fn) {
    let cur = startOfDay(typeof start === "string" ? parseDateStr(start) : start);
    const last = startOfDay(typeof end === "string" ? parseDateStr(end) : end);
    while (cur <= last) {
      fn(new Date(cur));
      cur = addDays(cur, 1);
    }
  }

  const SEED_VERSION = 2;

  function builtinCategories() {
    return [
      { id: "cat-classes", name: "School", color: "#4C7CF0", builtin: true, kind: "class" },
      { id: "cat-gym", name: "Gym", color: "#E25A3C", builtin: true, kind: "gym" },
      { id: "cat-events", name: "Events", color: "#3DAA6D", builtin: true, kind: "event" },
      { id: "cat-personal", name: "Personal", color: "#8B6BC4", builtin: true, kind: "personal" }
    ];
  }

  function defaultState() {
    return {
      version: 1,
      seedVersion: SEED_VERSION,
      onboarded: false,
      theme: "dark",
      settings: {
        remindersEnabled: false,
        defaultReminderMinutes: 15
      },
      categories: builtinCategories(),
      classes: fall2026Classes().concat(spring2027Classes()),
      gymPlan: null,
      events: fall2026Events().concat(spring2027Holidays()),
      tasks: [],
      workouts: []
    };
  }

  const SPRING_2027 = {
    start: "2027-01-06",
    end: "2027-05-04",
    daySkips: ["2027-01-18", "2027-02-19", "2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04", "2027-03-05", "2027-03-06", "2027-03-07"],
    eveningSkips: ["2027-01-18", "2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04", "2027-03-05", "2027-03-06", "2027-03-07"]
  };

  const FALL_2026 = {
    start: "2026-08-21",
    end: "2026-12-15",
    skips: ["2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]
  };

  function fall2026Classes() {
    const loc = "Broward College";
    const base = { categoryId: "cat-classes", startDate: FALL_2026.start, endDate: FALL_2026.end, location: loc, notes: "", reminderMinutes: 15, skipDates: FALL_2026.skips.slice() };
    return [
      Object.assign({ id: "cls-comp-lit", name: "Computer Literacy", shortName: "Comp Lit", days: [1, 3], startTime: "09:30", endTime: "10:45" }, base),
      Object.assign({ id: "cls-music", name: "Music Appreciation", shortName: "Music", days: [1, 3], startTime: "11:00", endTime: "12:15" }, base),
      Object.assign({ id: "cls-sls", name: "SLS College Success Skills", shortName: "SLS", days: [1], startTime: "13:00", endTime: "13:50" }, base),
      Object.assign({ id: "cls-amh2010", name: "AMH2010 American History", shortName: "AMH2010", days: [2], startTime: "11:00", endTime: "12:15" }, base),
      Object.assign({ id: "cls-algebra", name: "College Algebra", shortName: "Algebra", days: [1, 2, 3, 4, 5], startTime: "14:00", endTime: "14:50" }, base),
      Object.assign({ id: "cls-enc1101", name: "ENC1101", shortName: "ENC1101", days: [1, 2, 3, 4, 5], startTime: "15:00", endTime: "15:50" }, base)
    ];
  }

  function fall2026Events() {
    return [
      { id: "ev-thanksgiving-2026", title: "Thanksgiving break - no classes", categoryId: "cat-events", date: "2026-11-25", allDay: true, startTime: "", endTime: "", location: "Broward College", notes: "No classes, November 25–29.", recurrence: { freq: "daily", until: "2026-11-29", skipDates: [] }, skipDates: [], reminderMinutes: null },
      { id: "ev-fall-finals-2026", title: "Fall finals week", categoryId: "cat-events", date: "2026-12-09", allDay: true, startTime: "", endTime: "", location: "Broward College", notes: "Final examination week, December 9–15.", recurrence: { freq: "daily", until: "2026-12-15", skipDates: [] }, skipDates: [], reminderMinutes: null }
    ];
  }

  function spring2027Classes() {
    const loc = "Broward College";
    const base = { categoryId: "cat-classes", startDate: SPRING_2027.start, endDate: SPRING_2027.end, location: loc, notes: "", reminderMinutes: 15 };
    return [
      Object.assign({ id: "cls-chm1045", name: "General Chemistry 1 (CHM 1045)", shortName: "CHM 1045", days: [1, 3], startTime: "09:30", endTime: "10:45", skipDates: SPRING_2027.daySkips.slice() }, base),
      Object.assign({ id: "cls-spc1608", name: "Public Speaking (SPC 1608)", shortName: "SPC 1608", days: [2, 4], startTime: "09:30", endTime: "10:45", skipDates: SPRING_2027.daySkips.slice() }, base),
      Object.assign({ id: "cls-amh2020", name: "History of the United States Since 1877 (AMH 2020)", shortName: "AMH 2020", days: [2, 4], startTime: "11:00", endTime: "12:15", skipDates: SPRING_2027.daySkips.slice() }, base),
      Object.assign({ id: "cls-enc1102", name: "ENC1102 (tentative)", shortName: "ENC1102", days: [1, 2, 3, 4, 5], startTime: "13:00", endTime: "13:50", skipDates: SPRING_2027.daySkips.slice(), notes: "Tentative. Times and days may change." }, base),
      Object.assign({ id: "cls-mac1114", name: "Trigonometry (MAC 1114)", shortName: "MAC 1114", days: [1, 2, 3, 4, 5], startTime: "14:00", endTime: "14:50", skipDates: SPRING_2027.daySkips.slice() }, base),
      Object.assign({ id: "cls-chm1045l", name: "Gen Chem Lab I (CHM 1045L)", shortName: "CHM 1045L", days: [4], startTime: "18:30", endTime: "21:20", skipDates: SPRING_2027.eveningSkips.slice(), notes: "Evening lab. Still meets on Professional Development Day (Feb 19) because it starts after 5 p.m." }, base)
    ];
  }

  function spring2027Holidays() {
    return [
      { id: "ev-mlk-2027", title: "MLK Day (college closed)", categoryId: "cat-events", date: "2027-01-18", allDay: true, startTime: "", endTime: "", location: "Broward College", notes: "No day or evening classes.", recurrence: null, skipDates: [], reminderMinutes: null },
      { id: "ev-pd-2027", title: "Professional Development Day (no day classes)", categoryId: "cat-events", date: "2027-02-19", allDay: true, startTime: "", endTime: "", location: "Broward College", notes: "No day classes. Evening classes with a 5 p.m. start still meet.", recurrence: null, skipDates: [], reminderMinutes: null },
      { id: "ev-break-2027", title: "Spring Break (college closed)", categoryId: "cat-events", date: "2027-03-01", allDay: true, startTime: "", endTime: "", location: "Broward College", notes: "No day or evening classes, March 1–7.", recurrence: { freq: "daily", until: "2027-03-07", skipDates: [] }, skipDates: [], reminderMinutes: null }
    ];
  }

  function hasSameClass(list, cls) {
    return list.some((c) => c.id === cls.id || (c.name === cls.name && c.startTime === cls.startTime && c.startDate === cls.startDate));
  }

  function hasSameEvent(list, ev) {
    return list.some((e) => e.id === ev.id || (e.title === ev.title && e.date === ev.date));
  }

  function applySeedMigration(s) {
    const incoming = Number(s.seedVersion) || 0;
    if (incoming < 2) {
      fall2026Classes().forEach((cls) => {
        if (!hasSameClass(s.classes, cls)) s.classes.push(cls);
      });
      fall2026Events().forEach((ev) => {
        if (!hasSameEvent(s.events, ev)) s.events.push(ev);
      });
    }
    const fresh = builtinCategories();
    fresh.forEach((want) => {
      const have = s.categories.find((c) => c.id === want.id);
      if (!have) {
        s.categories.unshift(want);
        return;
      }
      if (have.id === "cat-classes" && have.name === "Classes") have.name = "School";
      if (have.builtin) have.color = want.color;
      if (have.id === "cat-classes") have.name = have.name === "Classes" ? "School" : (have.name || "School");
    });
    const school = s.categories.find((c) => c.id === "cat-classes");
    if (school && school.name === "Classes") school.name = "School";
    s.theme = "dark";
    s.seedVersion = SEED_VERSION;
    s._seedMigrated = incoming < SEED_VERSION;
    return s;
  }

  function normalize(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;
    const incomingVersion = raw.seedVersion != null ? Number(raw.seedVersion) : 0;
    const s = Object.assign({}, base, raw);
    s.settings = Object.assign({}, base.settings, raw.settings || {});
    s.categories = Array.isArray(raw.categories) && raw.categories.length ? raw.categories.slice() : builtinCategories();
    s.classes = Array.isArray(raw.classes) ? raw.classes.slice() : [];
    s.events = Array.isArray(raw.events) ? raw.events.slice() : [];
    s.tasks = Array.isArray(raw.tasks) ? raw.tasks.slice() : [];
    s.workouts = Array.isArray(raw.workouts) ? raw.workouts.slice() : [];
    s.seedVersion = incomingVersion;
    s.theme = "dark";
    return applySeedMigration(s);
  }

  let data = defaultState();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? normalize(JSON.parse(raw)) : defaultState();
    } catch (err) {
      console.warn("llc: could not load saved data", err);
      data = defaultState();
    }
    if (data._seedMigrated) {
      delete data._seedMigrated;
      save();
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      console.warn("llc: could not save", err);
    }
  }

  function get() { return data; }

  function replace(next) {
    data = normalize(next);
    save();
    return data;
  }

  function update(mutator) {
    mutator(data);
    save();
    return data;
  }

  function categoryById(id) {
    return data.categories.find((c) => c.id === id) || data.categories[2] || data.categories[0];
  }

  function inSkip(list, dateStr) {
    return Array.isArray(list) && list.indexOf(dateStr) !== -1;
  }

  function occBase(partial) {
    return Object.assign({
      allDay: false,
      location: "",
      notes: "",
      reminderMinutes: null,
      startTime: "",
      endTime: ""
    }, partial);
  }

  function getOccurrencesInRange(rangeStart, rangeEnd, opts) {
    opts = opts || {};
    const hidden = opts.hiddenCats || new Set();
    const start = startOfDay(typeof rangeStart === "string" ? parseDateStr(rangeStart) : rangeStart);
    const end = startOfDay(typeof rangeEnd === "string" ? parseDateStr(rangeEnd) : rangeEnd);
    const items = [];

    data.classes.forEach((cls) => {
      if (hidden.has(cls.categoryId || "cat-classes")) return;
      const cs = parseDateStr(cls.startDate);
      const ce = parseDateStr(cls.endDate);
      const from = cs > start ? cs : start;
      const to = ce < end ? ce : end;
      if (from > to) return;
      eachDate(from, to, (d) => {
        if ((cls.days || []).indexOf(d.getDay()) === -1) return;
        const ds = toDateStr(d);
        if (inSkip(cls.skipDates, ds)) return;
        items.push(occBase({
          id: "class:" + cls.id + ":" + ds,
          source: "class",
          classId: cls.id,
          title: cls.name,
          shortName: cls.shortName || "",
          categoryId: cls.categoryId || "cat-classes",
          date: ds,
          startTime: cls.startTime,
          endTime: cls.endTime,
          location: cls.location || "",
          notes: cls.notes || "",
          reminderMinutes: cls.reminderMinutes
        }));
      });
    });

    const plan = data.gymPlan;
    if (plan && plan.weeks && !hidden.has(plan.categoryId || "cat-gym")) {
      const sessions = ["Push", "Pull", "Legs", "Bonus"];
      Object.keys(plan.weeks).forEach((weekKey) => {
        const week = plan.weeks[weekKey] || {};
        sessions.forEach((name) => {
          const slot = week[name];
          const ds = typeof slot === "string" ? slot : (slot && slot.date);
          if (!ds) return;
          const d = parseDateStr(ds);
          if (!d || d < start || d > end) return;
          const dow = d.getDay();
          if (dow === 0 || dow === 6) return;
          if (inSkip(plan.skipDates, ds)) return;
          items.push(occBase({
            id: "gym:" + name.toLowerCase() + ":" + ds,
            source: "gym",
            title: name,
            categoryId: plan.categoryId || "cat-gym",
            date: ds,
            startTime: (typeof week[name] === "object" ? (week[name].startTime || "") : (plan.startTime || "")),
            endTime: (typeof week[name] === "object" ? (week[name].endTime || "") : (plan.endTime || "")),
            allDay: !(typeof week[name] === "object" ? (week[name].startTime || "") : (plan.startTime || "")),
            location: plan.location || "",
            notes: name === "Bonus" ? "Bonus session" : "",
            gymName: name
          }));
        });
      });
    }

    data.events.forEach((ev) => {
      if (hidden.has(ev.categoryId || "cat-events")) return;
      const rec = ev.recurrence;
      if (!rec) {
        const d = parseDateStr(ev.date);
        if (d >= start && d <= end && !inSkip(ev.skipDates, ev.date)) {
          items.push(occBase({
            id: "event:" + ev.id + ":" + ev.date,
            source: "event",
            eventId: ev.id,
            title: ev.title,
            categoryId: ev.categoryId || "cat-events",
            date: ev.date,
            startTime: ev.startTime,
            endTime: ev.endTime,
            allDay: !!ev.allDay,
            location: ev.location || "",
            notes: ev.notes || "",
            reminderMinutes: ev.reminderMinutes
          }));
        }
        return;
      }
      const cs = parseDateStr(ev.date);
      const ce = rec.until ? parseDateStr(rec.until) : end;
      const from = cs > start ? cs : start;
      const to = ce < end ? ce : end;
      if (from > to) return;
      eachDate(from, to, (d) => {
        const ds = toDateStr(d);
        if (inSkip(rec.skipDates, ds) || inSkip(ev.skipDates, ds)) return;
        if (rec.freq === "weekly") {
          const days = rec.days && rec.days.length ? rec.days : [cs.getDay()];
          if (days.indexOf(d.getDay()) === -1) return;
        } else if (rec.freq === "daily") {
          /* every day */
        } else if (rec.freq === "monthly") {
          if (d.getDate() !== cs.getDate()) return;
        } else {
          if (d.getDay() !== cs.getDay()) return;
        }
        items.push(occBase({
          id: "event:" + ev.id + ":" + ds,
          source: "event",
          eventId: ev.id,
          title: ev.title,
          categoryId: ev.categoryId || "cat-events",
          date: ds,
          startTime: ev.startTime,
          endTime: ev.endTime,
          allDay: !!ev.allDay,
          location: ev.location || "",
          notes: ev.notes || "",
          reminderMinutes: ev.reminderMinutes
        }));
      });
    });

    data.tasks.forEach((task) => {
      if (!task.dueDate) return;
      const catId = task.categoryId || "cat-classes";
      if (hidden.has(catId)) return;
      const d = parseDateStr(task.dueDate);
      if (d < start || d > end) return;
      items.push(occBase({
        id: "task:" + task.id,
        source: "task",
        taskId: task.id,
        classId: task.classId || "",
        title: task.title,
        categoryId: catId,
        date: task.dueDate,
        startTime: task.dueTime || "",
        endTime: "",
        allDay: !task.dueTime,
        notes: task.notes || "",
        reminderMinutes: task.reminderMinutes,
        done: !!task.done
      }));
    });

    items.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return minutesSinceMidnight(a.startTime) - minutesSinceMidnight(b.startTime);
    });
    return items;
  }

  function exportJSON() {
    return JSON.stringify(data, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid backup file");
    data = normalize(parsed);
    save();
    return data;
  }

  function clearAll() {
    data = defaultState();
    data.onboarded = true;
    save();
    return data;
  }

  function workoutForDate(dateStr) {
    return data.workouts.find((w) => w.date === dateStr) || null;
  }

  function exerciseHistory(name) {
    const needle = name.trim().toLowerCase();
    const rows = [];
    data.workouts
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((w) => {
        (w.exercises || []).forEach((ex) => {
          if ((ex.name || "").trim().toLowerCase() === needle) {
            rows.push({ date: w.date, name: ex.name, sets: ex.sets || [] });
          }
        });
      });
    return rows;
  }

  global.LLCStore = {
    KEY, WEEKDAYS, WEEKDAYS_LONG, MONTHS,
    pad, uid, toDateStr, parseDateStr, startOfDay, addDays, startOfWeek, endOfWeek, startOfGymWeek,
    startOfMonth, daysInMonth, minutesSinceMidnight, formatTime, formatTimeCompact, formatTimeRangeCompact, formatGCalTime, formatGCalRange, formatDateNice,
    combine, eachDate, defaultState,
    load, save, get, replace, update, categoryById,
    getOccurrencesInRange, exportJSON, importJSON, clearAll,
    workoutForDate, exerciseHistory, SPRING_2027, FALL_2026, SEED_VERSION
  };
})(window);
