/* llc — UI */
(function () {
  const S = window.LLCStore;

  const CAT_PRI = { "cat-classes": 0, "cat-gym": 1, "cat-events": 2, "cat-personal": 3 };

  const ui = {
    page: "home",
    mode: "month",
    cursor: new Date(),
    hiddenCats: new Set(),
    taskFilter: "open",
    sidebarOpen: false,
    gymWeek: null,
    openClassDays: new Set(),
    revealDay: "",
    boardAnim: ""
  };

  const hubMotion = { running: false, raf: 0, nodes: [], onMove: null, onResize: null, mouse: { x: 0, y: 0, inside: false } };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function catColor(id) {
    const c = S.categoryById(id);
    return (c && c.color) || "#888";
  }

  function catName(id) {
    const c = S.categoryById(id);
    return (c && c.name) || "";
  }

  function shortTitle(occ) {
    return occ.shortName || occ.title;
  }

  function startMs(occ) {
    if (occ.allDay || !occ.startTime) return S.combine(occ.date, "00:00").getTime();
    return S.combine(occ.date, occ.startTime).getTime();
  }

  function endMs(occ) {
    if (occ.allDay || !occ.endTime) {
      return occ.allDay ? S.combine(occ.date, "23:59").getTime() : startMs(occ) + 60 * 60 * 1000;
    }
    const end = S.combine(occ.date, occ.endTime).getTime();
    return end > startMs(occ) ? end : startMs(occ) + 30 * 60 * 1000;
  }

  function compareOcc(a, b) {
    const d = startMs(a) - startMs(b);
    if (d) return d;
    const pa = CAT_PRI[a.categoryId];
    const pb = CAT_PRI[b.categoryId];
    return (pa == null ? 9 : pa) - (pb == null ? 9 : pb);
  }

  function timeLabel(occ) {
    if (occ.allDay || !occ.startTime) return "All day";
    return S.formatTime(occ.startTime) + (occ.endTime ? " – " + S.formatTime(occ.endTime) : "");
  }

  function timeLabelCompact(occ) {
    if (occ.allDay || !occ.startTime) return "All day";
    return S.formatTimeRangeCompact(occ.startTime, occ.endTime);
  }

  /* School classes collapse into one "Classes" bar per day (click to expand / collapse). */
  function isClassOcc(it) {
    return it.source === "class" && !it.allDay && !!it.startTime;
  }

  function classGroupFor(ds, items) {
    const cls = items.filter(isClassOcc).sort(compareOcc);
    if (cls.length < 2) return null;
    let s0 = cls[0].startTime, e0 = cls[0].endTime || cls[0].startTime;
    cls.forEach(function (c) {
      if (c.startTime < s0) s0 = c.startTime;
      const e = c.endTime || c.startTime;
      if (e > e0) e0 = e;
    });
    return {
      id: "classes:" + ds, source: "classgroup", title: "Classes", shortName: "Classes",
      categoryId: cls[0].categoryId || "cat-classes", date: ds, startTime: s0, endTime: e0,
      allDay: false, children: cls, location: "", notes: "", isOpen: ui.openClassDays.has(ds)
    };
  }

  /* Returns the day's items with classes folded into one bar (or expanded, with children flagged). */
  function foldClasses(ds, items) {
    const g = classGroupFor(ds, items);
    if (!g) return items;
    if (ui.openClassDays.has(ds)) {
      g.isOpen = true;
      g.children.forEach(function (c) { c._inGroup = true; });
      return items;
    }
    return items.filter(function (it) { return !isClassOcc(it); }).concat([g]).sort(compareOcc);
  }

  /* Google/Apple Calendar-style: anything that has already finished is shown in a softer tint. Open homework is never dimmed. */
  function isPastOcc(it, nowMs) {
    if (it.source === "task" && !it.done) return false;
    if (it.allDay || !it.startTime) return it.date < S.toDateStr(new Date(nowMs));
    return endMs(it) <= nowMs;
  }

  function classSummary(g) {
    return g.children.map(function (c) { return shortTitle(c); }).join(" · ");
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", "dark");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#11110F");
  }

  function toast(msg) {
    const old = document.querySelector(".toast");
    if (old) old.remove();
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  }

  function initialCursor() {
    const now = new Date();
    const from = S.startOfMonth(now);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const here = S.getOccurrencesInRange(from, to);
    if (here.length) return now;
    const ahead = S.getOccurrencesInRange(now, S.addDays(now, 200));
    if (ahead.length) return S.parseDateStr(ahead[0].date);
    return now;
  }

  function periodLabel() {
    const d = ui.cursor;
    if (ui.page !== "calendar" && ui.page !== "agenda") return "";
    if (ui.page === "agenda") return "Upcoming";
    if (ui.mode === "month") return S.MONTHS[d.getMonth()] + " " + d.getFullYear();
    if (ui.mode === "week") {
      const a = S.startOfWeek(d);
      const b = S.addDays(a, 6);
      if (a.getMonth() === b.getMonth()) return S.MONTHS[a.getMonth()] + " " + a.getDate() + "–" + b.getDate() + ", " + a.getFullYear();
      return S.MONTHS[a.getMonth()] + " " + a.getDate() + " – " + S.MONTHS[b.getMonth()] + " " + b.getDate() + ", " + b.getFullYear();
    }
    return S.WEEKDAYS_LONG[d.getDay()] + ", " + S.MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  function shortPeriodLabel() {
    const d = ui.cursor;
    if (ui.page === "agenda") return "Upcoming";
    if (ui.page !== "calendar") return "";
    const m = S.MONTHS[(ui.mode === "week" ? S.startOfWeek(d) : d).getMonth()].slice(0, 3);
    if (ui.mode === "month") return m;
    return m + '<span class="pl-day"> ' + (ui.mode === "week" ? S.startOfWeek(d) : d).getDate() + "</span>";
  }

  /* First day of whatever period is on screen — used to pick the slide direction. */
  function periodStart(d, mode) {
    if (mode === "month") return S.startOfMonth(d);
    if (mode === "week") return S.startOfWeek(d);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /* Moves the calendar to a date; the board slides in from the side it came from. */
  function goToDate(date, mode) {
    const nextMode = mode || ui.mode;
    const a = periodStart(ui.cursor, ui.mode).getTime();
    const b = periodStart(date, nextMode).getTime();
    if (nextMode !== ui.mode) ui.boardAnim = "swap";
    else if (b > a) ui.boardAnim = "slide-next";
    else if (b < a) ui.boardAnim = "slide-prev";
    ui.cursor = new Date(date);
    ui.mode = nextMode;
    ui.page = "calendar";
    render();
  }

  function shiftPeriod(dir) {
    const d = new Date(ui.cursor);
    if (ui.mode === "month") {
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    }
    else if (ui.mode === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    goToDate(d);
  }

  function setMode(mode) {
    if (ui.page === "calendar" && mode === ui.mode) return;
    if (ui.page === "calendar") ui.boardAnim = "swap";
    ui.mode = mode;
    ui.page = "calendar";
    render();
  }

  /* ---- Mini month picker (click the period label, or press G) ---- */
  const picker = { open: false, month: null };

  function miniCalHTML() {
    const first = picker.month;
    const gridStart = S.startOfWeek(first);
    const todayStr = S.toDateStr(new Date());
    let rangeA = "", rangeB = "";
    if (ui.mode === "week") {
      rangeA = S.toDateStr(S.startOfWeek(ui.cursor));
      rangeB = S.toDateStr(S.addDays(S.startOfWeek(ui.cursor), 6));
    } else if (ui.mode === "day") {
      rangeA = rangeB = S.toDateStr(ui.cursor);
    }
    let html = '<div class="mc-head">' +
      '<button type="button" class="icon-btn mc-nav" data-mc="prev" aria-label="Previous month"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<span class="mc-title">' + S.MONTHS[first.getMonth()] + " " + first.getFullYear() + "</span>" +
      '<button type="button" class="icon-btn mc-nav" data-mc="next" aria-label="Next month"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5L16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      "</div>";
    html += '<div class="mc-grid" role="grid">';
    S.WEEKDAYS.forEach(function (w) { html += '<span class="mc-wd">' + w.charAt(0) + "</span>"; });
    for (let i = 0; i < 42; i++) {
      const d = S.addDays(gridStart, i);
      const ds = S.toDateStr(d);
      let cls = "mc-day";
      if (d.getMonth() !== first.getMonth()) cls += " is-outside";
      if (ds === todayStr) cls += " is-today";
      if (rangeA && ds >= rangeA && ds <= rangeB) {
        cls += " is-in";
        if (ds === rangeA) cls += " is-first";
        if (ds === rangeB) cls += " is-last";
      }
      html += '<button type="button" class="' + cls + '" data-mc="day" data-date="' + ds + '" aria-label="' +
        S.WEEKDAYS_LONG[d.getDay()] + ", " + S.MONTHS[d.getMonth()] + " " + d.getDate() + '"><span>' + d.getDate() + "</span></button>";
    }
    html += "</div>";
    return html;
  }

  function placePicker() {
    const el = document.getElementById("mini-cal");
    const label = document.getElementById("period-label");
    const r = label.getBoundingClientRect();
    const w = el.offsetWidth || 248;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    el.style.left = left + "px";
    el.style.top = Math.round(r.bottom + 8) + "px";
  }

  function paintPicker() {
    const el = document.getElementById("mini-cal");
    el.innerHTML = miniCalHTML();
  }

  function openPicker() {
    if (ui.page !== "calendar") return;
    const el = document.getElementById("mini-cal");
    picker.open = true;
    picker.month = S.startOfMonth(ui.cursor);
    paintPicker();
    el.hidden = false;
    placePicker();
    el.classList.remove("is-in");
    void el.offsetWidth;
    el.classList.add("is-in");
    document.getElementById("period-label").setAttribute("aria-expanded", "true");
  }

  function closePicker() {
    if (!picker.open) return;
    picker.open = false;
    document.getElementById("mini-cal").hidden = true;
    document.getElementById("period-label").setAttribute("aria-expanded", "false");
  }

  function bindPicker() {
    const el = document.getElementById("mini-cal");
    document.getElementById("period-label").addEventListener("click", function (e) {
      e.stopPropagation();
      if (picker.open) closePicker(); else openPicker();
    });
    el.addEventListener("click", function (e) {
      e.stopPropagation();
      const b = e.target.closest("[data-mc]");
      if (!b) return;
      const kind = b.getAttribute("data-mc");
      if (kind === "prev" || kind === "next") {
        const m = new Date(picker.month);
        m.setMonth(m.getMonth() + (kind === "next" ? 1 : -1));
        picker.month = m;
        paintPicker();
        return;
      }
      if (kind === "day") {
        closePicker();
        goToDate(S.parseDateStr(b.getAttribute("data-date")));
      }
    });
    document.addEventListener("click", function (e) {
      if (picker.open && !el.contains(e.target)) closePicker();
    });
    window.addEventListener("resize", function () { if (picker.open) placePicker(); });
  }


  function render() {
    applyTheme();
    closePeek();
    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-page") === ui.page);
    });
    const switcher = document.getElementById("view-switch");
    const dateNav = document.getElementById("date-nav");
    const showCalNav = ui.page === "calendar";
    switcher.hidden = !showCalNav;
    dateNav.hidden = !showCalNav;
    if (showCalNav) {
      switcher.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-mode") === ui.mode);
      });
    }
    const label = document.getElementById("period-label");
    label.innerHTML = '<span class="pl-long">' + esc(periodLabel()) + '</span><span class="pl-short">' + shortPeriodLabel() + "</span>";
    label.disabled = ui.page !== "calendar";
    if (ui.page !== "calendar") closePicker();
    else if (picker.open) paintPicker();
    document.querySelectorAll(".view").forEach(function (v) { v.hidden = true; });
    const view = document.getElementById("view-" + ui.page);
    if (view) view.hidden = false;
    renderCatFilters();
    document.getElementById("app").classList.toggle("is-home", ui.page === "home");
    if (ui.page === "home") {
      if (!hubMotion.running) startHubMotion();
    } else {
      stopHubMotion();
    }
    if (ui.page === "calendar") renderCalendar();
    else if (ui.page === "agenda") renderAgendaPage();
    else if (ui.page === "classes") renderClassesPage();
    else if (ui.page === "gym") renderGymPage();
    else if (ui.page === "events") renderCategoryPage("events", "cat-events");
    else if (ui.page === "personal") renderCategoryPage("personal", "cat-personal");
    else if (ui.page === "tasks") renderTasksPage();
    else if (ui.page === "settings") renderSettingsPage();
    updateLiveTitle();
    closeSidebar();
  }

  function renderCatFilters() {
    const box = document.getElementById("category-filters");
    box.innerHTML = S.get().categories.map(function (c) {
      const off = ui.hiddenCats.has(c.id) ? " is-off" : "";
      return '<button type="button" class="cat-filter' + off + '" data-act="toggle-cat" data-id="' + esc(c.id) + '" aria-pressed="' + (off ? "false" : "true") + '" style="--c:' + esc(c.color) + '">' + esc(c.name) + "</button>";
    }).join("");
  }

  function renderCalendar() {
    closePeek();
    const board = document.getElementById("calendar-board");
    if (ui.mode === "month") board.innerHTML = monthHTML();
    else if (ui.mode === "week") board.innerHTML = timeCalHTML("week");
    else board.innerHTML = timeCalHTML("day");
    const anim = ui.boardAnim;
    ui.boardAnim = "";
    board.classList.remove("slide-next", "slide-prev", "swap");
    if (anim) {
      void board.offsetWidth;
      board.classList.add(anim);
    }
    renderSidePanel();
  }

  function getHourH() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--hour-h").trim();
    return parseFloat(v) || 56;
  }

  function monthHTML() {
    const first = S.startOfMonth(ui.cursor);
    const gridStart = S.startOfWeek(first);
    const todayStr = S.toDateStr(new Date());
    let html = '<div class="month-grid"><div class="month-weekdays">';
    S.WEEKDAYS.forEach(function (w) { html += "<span>" + w + "</span>"; });
    html += "</div>";
    for (let r = 0; r < 6; r++) {
      html += '<div class="month-row">';
      for (let c = 0; c < 7; c++) {
        const d = S.addDays(gridStart, r * 7 + c);
        const ds = S.toDateStr(d);
        const outside = d.getMonth() !== ui.cursor.getMonth();
        const raw = S.getOccurrencesInRange(d, d, { hiddenCats: ui.hiddenCats });
        const group = classGroupFor(ds, raw);
        const items = foldClasses(ds, raw);
        let cls = "day-cell";
        if (outside) cls += " is-outside";
        if (ds === todayStr) cls += " is-today";
        html += '<div class="' + cls + '" data-act="open-day" data-date="' + ds + '">';
        html += '<div class="day-num">' + d.getDate() + "</div>";
        const open = !!(group && group.isOpen);
        const reveal = ui.revealDay === ds ? " is-reveal" : "";
        const max = open ? 99 : 3;
        const nowMs = Date.now();
        const shown = open
          ? [group].concat(group.children, items.filter(function (it) { return !it._inGroup; }))
          : items;
        shown.slice(0, max).forEach(function (it) {
          if (it.source === "classgroup") {
            html += '<button type="button" class="evt-pill is-group' + (it.isOpen ? " is-open" : "") + (isPastOcc(it, nowMs) ? " is-past" : "") + reveal + '" data-act="toggle-classes" data-date="' + ds + '" aria-expanded="' + (it.isOpen ? "true" : "false") + '" style="--c:' + esc(catColor(it.categoryId)) + '">' +
              '<span class="pt">Classes</span><span class="pm">' + esc(S.formatTimeRangeCompact(it.startTime, it.endTime)) + "</span></button>";
            return;
          }
          const taskClass = it.source === "task" ? " is-task" + (it.done ? " is-done" : "") : "";
          const child = it._inGroup ? " is-child" + reveal : "";
          const past = isPastOcc(it, nowMs) ? " is-past" : "";
          html += '<button type="button" class="evt-pill' + taskClass + child + past + '" data-act="open-occ" data-id="' + esc(it.id) + '" style="--c:' + esc(catColor(it.categoryId)) + '">' +
            esc(shortTitle(it)) + "</button>";
        });
        if (shown.length > max) {
          html += '<button type="button" class="more-btn" data-act="open-day" data-date="' + ds + '">+' + (shown.length - max) + " more</button>";
        }
        html += "</div>";
      }
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function packColumns(items) {
    const sorted = items.slice().sort(function (a, b) { return startMs(a) - startMs(b) || endMs(b) - endMs(a); });
    const colEnds = [];
    sorted.forEach(function (it) {
      const s = startMs(it), e = endMs(it);
      let col = 0;
      while (col < colEnds.length && colEnds[col] > s) col++;
      it._col = col;
      colEnds[col] = e;
    });
    const n = Math.max(1, colEnds.length);
    sorted.forEach(function (it) { it._cols = n; });
    return sorted;
  }

  function visibleRange(dayDates) {
    const DEF_START = 7 * 60 + 30;
    const DEF_END = 22 * 60 + 30;
    let start = DEF_START, end = DEF_END;
    dayDates.forEach(function (d) {
      S.getOccurrencesInRange(d, d, { hiddenCats: ui.hiddenCats }).forEach(function (it) {
        if (it.allDay || !it.startTime) return;
        /* Homework due times are deadlines, not blocks of time: they get pinned inside the frame instead of stretching it. */
        if (it.source === "task") return;
        const a = S.minutesSinceMidnight(it.startTime);
        const b = it.endTime ? S.minutesSinceMidnight(it.endTime) : a + 60;
        if (a < start) start = Math.floor(a / 30) * 30;
        if (b > end) end = Math.ceil(b / 30) * 30;
      });
    });
    start = Math.max(0, start);
    end = Math.min(24 * 60, Math.max(end, start + 60));
    return { start: start, end: end };
  }

  function gutterLabel(mins) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = (h % 12) || 12;
    return m ? h12 + ":" + S.pad(m) + " " + ap : h12 + " " + ap;
  }

  function timeCalHTML(kind) {
    const isWeek = kind === "week";
    const start = isWeek ? S.startOfWeek(ui.cursor) : S.startOfDay(ui.cursor);
    const days = isWeek ? 7 : 1;
    const dayDates = [];
    for (let i = 0; i < days; i++) dayDates.push(S.addDays(start, i));
    const todayStr = S.toDateStr(new Date());
    const now = new Date();
    const range = visibleRange(dayDates);
    const span = range.end - range.start;

    function yPct(mins) {
      return ((mins - range.start) / span) * 100;
    }

    let html = '<div class="time-cal is-' + kind + '" data-vis-start="' + range.start + '" data-vis-end="' + range.end + '">';
    html += '<div class="time-head"><div class="gutter"></div>';
    dayDates.forEach(function (d) {
      const ds = S.toDateStr(d);
      html += '<div class="head-cell' + (ds === todayStr ? " is-today" : "") + '" data-act="open-day" data-date="' + ds + '">' +
        '<span class="wd">' + S.WEEKDAYS[d.getDay()] + "</span>" +
        '<span class="dn">' + d.getDate() + "</span></div>";
    });
    html += "</div>";

    const allDayByDay = dayDates.map(function (d) {
      return S.getOccurrencesInRange(d, d, { hiddenCats: ui.hiddenCats }).filter(function (it) { return it.allDay || !it.startTime; });
    });
    const hasAllDay = allDayByDay.some(function (items) { return items.length; });
    if (hasAllDay) {
      html += '<div class="allday-row"><div class="gutter"></div>';
      allDayByDay.forEach(function (items) {
        html += '<div class="allday-cell">';
        items.forEach(function (it) {
          const taskClass = it.source === "task" ? " is-task" + (it.done ? " is-done" : "") : "";
          const past = isPastOcc(it, now.getTime()) ? " is-past" : "";
          html += '<button type="button" class="evt-pill' + taskClass + past + '" data-act="open-occ" data-id="' + esc(it.id) + '" style="--c:' + esc(catColor(it.categoryId)) + '">' + esc(shortTitle(it)) + "</button>";
        });
        html += "</div>";
      });
      html += "</div>";
    }

    html += '<div class="timed-scroll"><div class="timed-body">';
    html += '<div class="hours">';
    const marks = [];
    if (range.start % 60 !== 0) marks.push(range.start);
    for (let m = Math.ceil(range.start / 60) * 60; m <= range.end; m += 60) marks.push(m);
    if (range.end % 60 !== 0 && marks[marks.length - 1] !== range.end) marks.push(range.end);
    marks.forEach(function (m, i) {
      const top = yPct(m);
      const edge = i === 0 ? " is-start" : (i === marks.length - 1 ? " is-end" : "");
      html += '<div class="hour-line' + edge + '" style="top:' + top + '%"></div>';
      const tooClose = (m !== range.start && Math.abs(m - range.start) < 30) || (m !== range.end && Math.abs(m - range.end) < 30);
      if (!tooClose) html += '<div class="hour-label' + edge + '" style="top:' + top + '%">' + esc(gutterLabel(m)) + "</div>";
    });
    html += "</div>";

    dayDates.forEach(function (d) {
      const ds = S.toDateStr(d);
      const timed = S.getOccurrencesInRange(d, d, { hiddenCats: ui.hiddenCats }).filter(function (it) { return !it.allDay && it.startTime; });
      const group = classGroupFor(ds, timed);
      const items = packColumns(foldClasses(ds, timed));
      const open = !!(group && group.isOpen);
      const reveal = ui.revealDay === ds ? " is-reveal" : "";
      html += '<div class="day-col' + (open ? " has-rail" : "") + '" data-act="add-at" data-date="' + ds + '">';
      if (ds === todayStr) {
        const nowMin = now.getHours() * 60 + now.getMinutes();
        if (nowMin >= range.start && nowMin <= range.end) {
          html += '<div class="now-line" style="top:' + yPct(nowMin) + '%"></div>';
        }
      }
      if (open) {
        const gs = S.minutesSinceMidnight(group.startTime), ge = S.minutesSinceMidnight(group.endTime);
        html += '<button type="button" class="cls-rail' + reveal + '" data-act="toggle-classes" data-date="' + ds + '" aria-expanded="true" aria-label="Collapse classes" title="Collapse classes" style="--c:' + esc(catColor(group.categoryId)) + ";top:" + yPct(gs) + "%;height:calc(" + ((ge - gs) / span * 100) + '% - 2px)"></button>';
      }
      html += '<div class="col-blocks">';
      items.forEach(function (it) {
        const startMin = S.minutesSinceMidnight(it.startTime);
        const endMin = it.endTime ? S.minutesSinceMidnight(it.endTime) : startMin + 60;
        let dur = Math.max(endMin - startMin, 15);
        let topMin = startMin;
        if (it.source === "task") {
          dur = Math.min(30, span);
          topMin = Math.max(range.start, Math.min(startMin, range.end - dur));
        }
        const top = yPct(topMin);
        const height = (dur / span) * 100;
        const width = 100 / it._cols;
        const left = width * it._col;
        const detailed = kind === "day";
        const descBits = [];
        if (detailed && dur < 75) {
          /* too short for a description line */
        } else if (detailed && it.source === "classgroup") {
          descBits.push(classSummary(it));
        } else if (detailed) {
          if (it.location) descBits.push(it.location);
          if (it.notes) descBits.push(it.notes);
          if (it.source === "task") descBits.push("Homework" + (it.done ? " (done)" : ""));
        }
        const isShort = dur < (detailed ? 30 : 40);
        const sty = "--c:" + catColor(it.categoryId) + ";top:" + top + "%;height:calc(" + height + "% - 2px);left:calc(" + left + "% + 2px);width:calc(" + width + "% - 4px);right:auto;";
        const isGroup = it.source === "classgroup";
        const act = isGroup ? 'data-act="toggle-classes" data-date="' + ds + '" aria-expanded="false"' : 'data-act="open-occ" data-id="' + esc(it.id) + '"';
        const extra = (detailed ? " is-detailed" : "") + (isShort ? " is-short" : "") + (isGroup ? " is-group" + reveal : "") + (it._inGroup ? " is-child" + reveal : "") + (isPastOcc(it, now.getTime()) ? " is-past" : "");
        html += '<button type="button" class="evt-block' + extra + '" ' + act + ' style="' + sty + '">';
        if (isShort) {
          html += '<span class="ttl">' + esc(shortTitle(it)) + ", " + esc(S.formatGCalTime(it.startTime)) + "</span>";
        } else {
          html += '<span class="ttl">' + (detailed ? esc(it.title) : esc(shortTitle(it))) + "</span>";
          html += '<span class="t">' + esc(S.formatGCalRange(it.startTime, it.endTime)) + "</span>";
        }
        if (descBits.length) html += '<span class="desc">' + esc(descBits.join(" · ")) + "</span>";
        html += "</button>";
      });
      html += "</div></div>";
    });

    html += "</div></div></div>";
    return html;
  }

  function occRow(it, extra, whenText, opts) {
    const o = opts || {};
    const cls = "agenda-item" + (it._inGroup ? " is-child" : "") + (o.reveal ? " is-reveal" : "") + (o.progress != null ? " has-progress" : "") + (it.source === "task" && it.done ? " is-done" : "");
    const prog = o.progress != null ? '<span class="fill" style="--p:' + Math.max(0, Math.min(1, o.progress)).toFixed(4) + '"></span>' : "";
    return '<button type="button" class="' + cls + '" data-act="open-occ" data-id="' + esc(it.id) + '" style="--c:' + esc(catColor(it.categoryId)) + '">' + prog +
      '<span class="meta"><span class="title">' + esc(it.title) + (extra || "") + "</span>" +
      '<span class="sub">' + esc(whenText || timeLabel(it)) + "</span></span></button>";
  }

  function groupRow(g, reveal) {
    return '<button type="button" class="agenda-item is-group' + (g.isOpen ? " is-open" : "") + (reveal ? " is-reveal" : "") + '" data-act="toggle-classes" data-date="' + esc(g.date) + '" aria-expanded="' + (g.isOpen ? "true" : "false") + '" style="--c:' + esc(catColor(g.categoryId)) + '">' +
      '<span class="meta"><span class="title">Classes<span class="count">' + g.children.length + "</span></span>" +
      '<span class="sub">' + esc(timeLabel(g)) + "</span></span>" +
      '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
  }

  /* One day's rows for the side panel, with classes folded into one bar. */
  function dayRowsHTML(ds, items) {
    const group = classGroupFor(ds, items);
    const folded = foldClasses(ds, items);
    const reveal = ui.revealDay === ds;
    let html = "";
    let groupDone = false;
    folded.forEach(function (it) {
      if (it.source === "classgroup") { html += groupRow(it, reveal); return; }
      if (it._inGroup) {
        if (!groupDone) {
          groupDone = true;
          html += groupRow(group, reveal);
          group.children.forEach(function (c) { html += occRow(c, "", "", { reveal: reveal }); });
        }
        return;
      }
      html += occRow(it, it.source === "task" && it.done ? " · done" : "");
    });
    return html;
  }

  function durWords(ms) {
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return mins + " min";
    const h = Math.floor(mins / 60), m = mins % 60;
    return h + " hr" + (m ? " " + m + " min" : "");
  }

  function hideSpringLists() {
    return S.toDateStr(new Date()) < "2027-01-01";
  }

  function isSpringClassOcc(it) {
    if (it.source !== "class" || !it.classId) return false;
    const cls = S.get().classes.find(function (c) { return c.id === it.classId; });
    return !!(cls && cls.startDate && cls.startDate >= "2027-01-01");
  }

  function nextWhenLabel(it, todayStr) {
    if (it.date === todayStr) {
      if (it.allDay || !it.startTime) return "Today · All day";
      return "in " + durWords(startMs(it) - Date.now()) + " · " + timeLabel(it);
    }
    const d = S.parseDateStr(it.date);
    const dateBit = S.WEEKDAYS[d.getDay()] + ", " + S.MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate();
    if (it.allDay || !it.startTime) return dateBit + " · All day";
    return dateBit + " · " + S.formatTimeRangeCompact(it.startTime, it.endTime || it.startTime);
  }

  function upcomingWindow() {
    const now = new Date();
    const from = S.addDays(S.startOfDay(now), -1);
    const to = S.addDays(now, 90);
    let items = S.getOccurrencesInRange(from, to, { hiddenCats: ui.hiddenCats }).sort(compareOcc);
    if (hideSpringLists()) items = items.filter(function (it) { return !isSpringClassOcc(it); });
    return items;
  }

  function renderSidePanel() {
    document.getElementById("today-panel").innerHTML = rankedPanelHTML(true);
  }

  /* Fantastical/Structured-style: the browser tab shows what's on now (or next today), so a glance at the tab is enough. */
  function liveTitleText() {
    const now = new Date(), t = now.getTime();
    const todayStr = S.toDateStr(now);
    const timed = upcomingWindow().filter(function (it) {
      return it.date === todayStr && !it.allDay && it.startTime && it.source !== "task";
    });
    const cur = timed.filter(function (it) { return startMs(it) <= t && t < endMs(it); })[0];
    if (cur) return shortTitle(cur) + " · " + durWords(endMs(cur) - t) + " left — llc";
    const nxt = timed.filter(function (it) { return startMs(it) > t; })[0];
    if (nxt) return shortTitle(nxt) + " in " + durWords(startMs(nxt) - t) + " — llc";
    return "llc";
  }

  function updateLiveTitle() {
    const txt = liveTitleText();
    if (document.title !== txt) document.title = txt;
  }

  function rankedPanelHTML(compact) {
    const now = new Date();
    const todayStr = S.toDateStr(now);
    const all = upcomingWindow();
    const happening = all.filter(function (it) {
      return startMs(it) <= now.getTime() && now.getTime() < endMs(it) && !it.allDay;
    });
    const future = all.filter(function (it) {
      return startMs(it) > now.getTime() || (it.allDay && it.date >= todayStr);
    });
    const next = future.filter(function (it) { return !(it.source === "task" && it.done); })[0] || null;
    const todayItems = all.filter(function (it) { return it.date === todayStr; }).sort(compareOcc);
    const soonEnd = S.toDateStr(S.addDays(now, 7));
    const weekItems = all.filter(function (it) {
      return it.date > todayStr && it.date <= soonEnd && (it !== next || isClassOcc(it));
    }).sort(compareOcc);

    let html = '<h2 class="panel-title">' + esc(S.formatDateNice(now)) + "</h2>";
    html += '<div class="panel-section happening"><h3>' + (happening.length ? "Now · Next up" : "Next up") + "</h3>";
    if (!happening.length && !next) html += '<p class="empty-note">Nothing coming up.</p>';
    happening.forEach(function (it) {
      const s0 = startMs(it), e0 = endMs(it);
      const p = (now.getTime() - s0) / Math.max(1, e0 - s0);
      html += occRow(it, '<span class="badge-now">Now</span>', durWords(e0 - now.getTime()) + " left · ends " + S.formatTime(it.endTime || ""), { progress: p });
    });
    if (next) html += occRow(next, "", nextWhenLabel(next, todayStr));
    html += "</div>";

    html += '<div class="panel-section"><h3>Today</h3>';
    if (!todayItems.length) html += '<p class="empty-note">No items today.</p>';
    html += dayRowsHTML(todayStr, todayItems);
    html += "</div>";

    html += '<div class="panel-section"><h3>This week</h3>';
    if (!weekItems.length) html += '<p class="empty-note">Nothing scheduled this week.</p>';
    else {
      const byDate = [];
      weekItems.forEach(function (it) {
        const lastG = byDate[byDate.length - 1];
        if (!lastG || lastG.date !== it.date) byDate.push({ date: it.date, items: [it] });
        else lastG.items.push(it);
      });
      byDate.forEach(function (gp) {
        html += '<div class="agenda-date">' + esc(S.formatDateNice(gp.date)) + "</div>";
        html += dayRowsHTML(gp.date, gp.items);
      });
    }
    html += "</div>";
    return html;
  }

  function renderAgendaPage() {
    document.getElementById("view-agenda").innerHTML =
      '<div class="page-head"><div><h2>Agenda</h2></div></div>' +
      '<div class="card">' + rankedPanelHTML(false) + "</div>";
  }

  function weekdayChips(days) {
    return (days || []).slice().sort().map(function (d) { return S.WEEKDAYS[d]; }).join(" · ");
  }

  function renderClassesPage() {
    const classes = S.get().classes;
    let html = '<div class="page-head"><div><h2>School</h2></div>' +
      '<button class="primary-btn" type="button" data-act="add-class">Add class</button></div>';
    if (!classes.length) {
      html += '<div class="card"><p class="empty-note">No classes yet.</p></div>';
    }
    html += '<div class="card-list">';
    classes.forEach(function (cls) {
      html += '<div class="card"><div class="card-top"><div>' +
        "<h3>" + esc(cls.name) + "</h3>" +
        '<p class="muted">' + esc(weekdayChips(cls.days) + " · " + S.formatTime(cls.startTime) + " – " + S.formatTime(cls.endTime)) + "</p>" +
        '<p class="muted">' + esc((cls.location ? cls.location + " · " : "") + cls.startDate + " to " + cls.endDate) + "</p>" +
        (cls.notes ? '<p class="muted">' + esc(cls.notes) + "</p>" : "") +
        '</div><div class="row-actions">' +
        '<button class="ghost-btn" type="button" data-act="edit-class" data-id="' + esc(cls.id) + '">Edit</button>' +
        '<button class="danger-btn" type="button" data-act="delete-class" data-id="' + esc(cls.id) + '">Remove</button>' +
        "</div></div></div>";
    });
    html += "</div>";
    document.getElementById("view-classes").innerHTML = html;
  }

  const GYM_SESSIONS = ["Push", "Pull", "Legs", "Bonus"];

  function ensureGymPlan(data) {
    if (!data.gymPlan) {
      data.gymPlan = { startTime: "", endTime: "", location: "", weeks: {}, categoryId: "cat-gym", skipDates: [] };
    }
    if (!data.gymPlan.weeks) data.gymPlan.weeks = {};
    return data.gymPlan;
  }

  function gymSlot(week, name) {
    const slot = week && week[name];
    if (!slot) return null;
    if (typeof slot === "string") return { date: slot, startTime: "", endTime: "" };
    return { date: slot.date, startTime: slot.startTime || "", endTime: slot.endTime || "" };
  }

  function writeGymSlot(week, name, slot) {
    if (!slot || !slot.date) delete week[name];
    else if (!slot.startTime) week[name] = { date: slot.date, startTime: "", endTime: "" };
    else week[name] = { date: slot.date, startTime: slot.startTime, endTime: slot.endTime || "" };
  }

  function assignGymSession(session, dateStr) {
    if (GYM_SESSIONS.indexOf(session) === -1) return;
    const d = S.parseDateStr(dateStr);
    if (!d) return;
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return;
    const key = S.toDateStr(S.startOfGymWeek(d));
    S.update(function (data) {
      const plan = ensureGymPlan(data);
      const week = plan.weeks[key] || {};
      GYM_SESSIONS.forEach(function (n) {
        const sl = gymSlot(week, n);
        if (n !== session && sl && sl.date === dateStr) delete week[n];
      });
      const cur = gymSlot(week, session);
      week[session] = { date: dateStr, startTime: (cur && cur.startTime) || "", endTime: (cur && cur.endTime) || "" };
      plan.weeks[key] = week;
    });
    render();
  }

  function unassignGymSession(session, dateStr) {
    const key = S.toDateStr(S.startOfGymWeek(dateStr || (ui.gymWeek || new Date())));
    S.update(function (data) {
      if (!data.gymPlan || !data.gymPlan.weeks || !data.gymPlan.weeks[key]) return;
      delete data.gymPlan.weeks[key][session];
    });
    render();
  }

  function saveGymSlotTime(session, dateStr, startTime, endTime) {
    const key = S.toDateStr(S.startOfGymWeek(dateStr));
    S.update(function (data) {
      const plan = ensureGymPlan(data);
      const week = plan.weeks[key] || {};
      week[session] = { date: dateStr, startTime: startTime || "", endTime: (startTime && endTime) ? endTime : (startTime ? "" : "") };
      plan.weeks[key] = week;
    });
    render();
  }

  function openGymSlotEditor(session, dateStr) {
    const mon = S.toDateStr(S.startOfGymWeek(dateStr));
    const plan = S.get().gymPlan || {};
    const week = (plan.weeks && plan.weeks[mon]) || {};
    const slot = gymSlot(week, session) || { date: dateStr, startTime: "", endTime: "" };
    openModal(session,
      "<p class=\"muted\">" + esc(S.formatDateNice(dateStr)) + "</p>" +
      '<div class="form-grid">' +
        field("Start (optional)", '<input type="time" id="g-start" value="' + esc(slot.startTime) + '" />') +
        field("End (optional)", '<input type="time" id="g-end" value="' + esc(slot.endTime) + '" />') +
      "</div>",
      '<button class="ghost-btn" type="button" data-act="close-modal">Close</button>' +
      '<button class="danger-btn" type="button" data-act="gym-unassign" data-session="' + esc(session) + '" data-date="' + esc(dateStr) + '">Remove</button>' +
      '<button class="secondary-btn" type="button" data-act="log-workout" data-date="' + esc(dateStr) + '" data-name="' + esc(session) + '">Log workout</button>' +
      '<button class="primary-btn" type="button" data-act="save-gym-time" data-session="' + esc(session) + '" data-date="' + esc(dateStr) + '">Save</button>',
      { type: "gym-slot", session: session, date: dateStr }
    );
  }

  function workoutOn(ds) {
    return S.get().workouts.some(function (w) { return w.date === ds; });
  }

  /* Week at a glance: one chip per session (planned day, and a check once a workout is logged that day). */
  function gymGlanceHTML(week) {
    const todayStr = S.toDateStr(new Date());
    let html = '<div class="gym-glance" role="list">';
    GYM_SESSIONS.forEach(function (name, i) {
      const sl = gymSlot(week, name);
      const done = !!(sl && workoutOn(sl.date));
      const state = !sl ? "is-empty" : done ? "is-done" : "is-planned";
      let when = "Not set";
      if (sl) {
        const d = S.parseDateStr(sl.date);
        when = sl.date === todayStr ? "Today" : S.WEEKDAYS[d.getDay()];
        if (sl.startTime) when += " · " + S.formatGCalTime(sl.startTime);
      }
      const act = sl ? ' data-act="gym-edit" data-session="' + name + '" data-date="' + sl.date + '"' : "";
      html += '<' + (sl ? 'button type="button"' : "div") + ' role="listitem" class="gg-chip ' + state + (name === "Bonus" ? " is-bonus" : "") + '" style="--i:' + i + '"' + act + ">" +
        '<span class="gg-name">' + esc(name) + "</span>" +
        '<span class="gg-when">' + esc(when) + "</span>" +
        (done ? '<svg class="gg-check" viewBox="0 0 24 24" aria-label="Done"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : "") +
        "</" + (sl ? "button" : "div") + ">";
    });
    html += "</div>";
    return html;
  }

  function renderGymPage() {
    const weekStart = S.startOfGymWeek(ui.gymWeek || new Date());
    const key = S.toDateStr(weekStart);
    const plan = S.get().gymPlan || {};
    const week = (plan.weeks && plan.weeks[key]) || {};
    const workouts = S.get().workouts.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    const required = ["Push", "Pull", "Legs"].filter(function (n) { return !!gymSlot(week, n); }).length;
    const hasBonus = !!gymSlot(week, "Bonus");
    const doneReq = ["Push", "Pull", "Legs"].filter(function (n) { const sl = gymSlot(week, n); return !!(sl && workoutOn(sl.date)); }).length;
    const progress = required + "/3 planned" + (hasBonus ? " (+bonus)" : "") + (doneReq ? " · " + doneReq + " done" : "");
    const thisWeek = S.toDateStr(S.startOfGymWeek(new Date())) === key;

    let html = '<div class="page-head"><div><h2>Gym</h2></div></div>';
    html += '<div class="gym-week-bar">';
    html += '<button class="ghost-btn" type="button" data-act="gym-week" data-dir="-1">Previous</button>';
    html += "<div><h3>Week of " + esc(S.MONTHS[weekStart.getMonth()] + " " + weekStart.getDate()) + "</h3>";
    html += '<div class="gym-progress">' + esc(progress) + "</div></div>";
    html += '<div class="row-actions">';
    if (!thisWeek) html += '<button class="ghost-btn" type="button" data-act="gym-week" data-dir="0">This week</button>';
    html += '<button class="ghost-btn" type="button" data-act="gym-week" data-dir="1">Next</button></div></div>';
    html += gymGlanceHTML(week);

    html += '<div class="gym-grid">';
    html += '<div></div>';
    for (let i = 0; i < 5; i++) {
      const d = S.addDays(weekStart, i);
      html += '<div class="hd">' + esc(S.WEEKDAYS[d.getDay()] + " " + d.getDate()) + "</div>";
    }
    GYM_SESSIONS.forEach(function (name) {
      const bonus = name === "Bonus";
      const slot = gymSlot(week, name);
      html += '<div class="lab' + (bonus ? " is-bonus" : "") + '" draggable="true" data-gym-drag="' + name + '" data-session="' + name + '">' + esc(name) + "</div>";
      for (let i = 0; i < 5; i++) {
        const d = S.addDays(weekStart, i);
        const ds = S.toDateStr(d);
        const on = slot && slot.date === ds;
        const cls = "cell" + (on ? " is-on" : "") + (bonus ? " is-bonus" : "");
        const act = on ? "gym-edit" : "gym-assign";
        html += '<button type="button" class="' + cls + '" data-act="' + act + '" data-session="' + name + '" data-date="' + ds + '"></button>';
      }
    });
    html += "</div>";

    html += '<div class="page-head" style="margin-top:12px"><div><h2>Workout log</h2></div>' +
      '<button class="secondary-btn" type="button" data-act="log-workout">Log workout</button></div>';
    if (!workouts.length) {
      html += '<p class="empty-note">No workouts logged yet.</p>';
    } else {
      html += '<div class="card-list">';
      workouts.forEach(function (w) {
        const count = (w.exercises || []).length;
        html += '<div class="card"><div class="card-top"><div><h3>' + esc(w.name || "Workout") + "</h3>" +
          '<p class="muted">' + esc(S.formatDateNice(w.date) + " · " + count + " exercise" + (count === 1 ? "" : "s")) + "</p></div>" +
          '<button class="ghost-btn" type="button" data-act="log-workout" data-date="' + esc(w.date) + '">Edit</button></div></div>';
      });
      html += "</div>";
      const names = [];
      workouts.forEach(function (w) {
        (w.exercises || []).forEach(function (ex) {
          if (ex.name && names.indexOf(ex.name) === -1) names.push(ex.name);
        });
      });
      if (names.length) {
        html += '<div class="card" style="margin-top:14px"><h3>Exercise progress</h3>';
        names.forEach(function (n) {
          html += '<button class="occ-row" type="button" data-act="ex-history" data-name="' + esc(n) + '" style="--c:' + esc(catColor("cat-gym")) + '"><span class="meta"><span class="title">' + esc(n) + '</span><span class="sub">View history</span></span></button>';
        });
        html += "</div>";
      }
    }
    document.getElementById("view-gym").innerHTML = html;
  }

  function renderTasksPage() {
    const tasks = S.get().tasks.slice().sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1;
    });
    const todayStr = S.toDateStr(new Date());
    const filter = ui.taskFilter;
    const shown = tasks.filter(function (t) {
      if (filter === "open") return !t.done;
      if (filter === "done") return t.done;
      if (filter === "overdue") return !t.done && t.dueDate && t.dueDate < todayStr;
      return true;
    });
    let html = '<div class="page-head"><div><h2>Homework</h2></div>' +
      '<button class="primary-btn" type="button" data-act="add-task">Add</button></div>';
    html += '<div class="filter-bar">';
    [["open", "Open"], ["overdue", "Overdue"], ["done", "Done"], ["all", "All"]].forEach(function (pair) {
      html += '<button type="button" class="seg-chip' + (filter === pair[0] ? " is-on" : "") + '" data-act="task-filter" data-filter="' + pair[0] + '">' + pair[1] + "</button>";
    });
    html += "</div>";
    if (!shown.length) html += '<div class="card"><p class="empty-note">Nothing in this list.</p></div>';
    /* Things-style due-date groups. */
    const tomorrowStr = S.toDateStr(S.addDays(new Date(), 1));
    const weekEnd = S.toDateStr(S.addDays(new Date(), 7));
    const order = ["Overdue", "Today", "Tomorrow", "Next 7 days", "Later", "No due date", "Done"];
    const groups = {};
    shown.slice().sort(function (a, b) {
      const ka = (a.dueDate || "9999-99-99") + (a.dueTime || "99:99"), kb = (b.dueDate || "9999-99-99") + (b.dueTime || "99:99");
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }).forEach(function (t) {
      let g;
      if (t.done) g = "Done";
      else if (!t.dueDate) g = "No due date";
      else if (t.dueDate < todayStr) g = "Overdue";
      else if (t.dueDate === todayStr) g = "Today";
      else if (t.dueDate === tomorrowStr) g = "Tomorrow";
      else if (t.dueDate <= weekEnd) g = "Next 7 days";
      else g = "Later";
      (groups[g] = groups[g] || []).push(t);
    });
    order.forEach(function (g) {
      const list = groups[g];
      if (!list) return;
      html += '<div class="task-group' + (g === "Overdue" ? " is-overdue" : "") + '"><h3 class="tg-head">' + esc(g) + '<span class="tg-count">' + list.length + "</span></h3>";
      html += '<div class="card-list">';
      list.forEach(function (t) {
        const overdue = !t.done && t.dueDate && t.dueDate < todayStr;
        const cls = S.get().classes.find(function (c) { return c.id === t.classId; });
        const nearGroup = g === "Today" || g === "Tomorrow";
        const dueBit = t.dueDate ? (nearGroup ? (t.dueTime ? " · due " + S.formatTime(t.dueTime) : "") : " · due " + S.formatDateNice(t.dueDate) + (t.dueTime ? " " + S.formatTime(t.dueTime) : "")) : "";
        html += '<div class="task-row' + (t.done ? " is-done" : "") + (overdue ? " is-overdue" : "") + '">' +
          '<input type="checkbox" data-act="toggle-task" data-id="' + esc(t.id) + '"' + (t.done ? " checked" : "") + ' aria-label="Done" />' +
          '<button class="task-main" type="button" data-act="edit-task" data-id="' + esc(t.id) + '">' +
          '<div class="task-title">' + esc(t.title) + "</div>" +
          '<div class="muted due">' + esc((cls ? cls.shortName || cls.name : "General") + dueBit) + "</div>" +
          "</button></div>";
      });
      html += "</div></div>";
    });
    document.getElementById("view-tasks").innerHTML = html;
  }

  function renderCategoryPage(viewId, categoryId) {
    const cat = S.categoryById(categoryId);
    const title = cat && cat.name ? cat.name : viewId;
    const now = new Date();
    const items = S.getOccurrencesInRange(S.addDays(now, -14), S.addDays(now, 120), { hiddenCats: new Set() })
      .filter(function (it) { return it.categoryId === categoryId; });
    let html = '<div class="page-head"><div><h2>' + esc(title) + "</h2></div>" +
      '<button class="primary-btn" type="button" data-act="add-event" data-cat="' + esc(categoryId) + '">Add</button></div>';
    if (!items.length) html += '<div class="card"><p class="empty-note">Nothing in ' + esc(title) + " yet.</p></div>";
    else {
      let last = "";
      html += '<div class="card">';
      items.forEach(function (it) {
        if (it.date !== last) {
          html += '<div class="agenda-date">' + esc(S.formatDateNice(it.date)) + "</div>";
          last = it.date;
        }
        html += occRow(it);
      });
      html += "</div>";
    }
    document.getElementById("view-" + viewId).innerHTML = html;
  }

  function toHex(color) {
    if (!color) return "#888888";
    if (color.charAt(0) === "#" && color.length === 7) return color;
    return "#888888";
  }

  function renderSettingsPage() {
    const st = S.get();
    let html = '<div class="page-head"><div><h2>Settings</h2></div></div>';
    html += '<div class="settings-stack">';
    html += '<div class="card"><h3>Categories</h3>';
    st.categories.forEach(function (c) {
      html += '<div class="cat-edit"><input type="color" data-act="cat-color" data-id="' + esc(c.id) + '" value="' + esc(toHex(c.color)) + '" />' +
        '<input type="text" data-act="cat-name" data-id="' + esc(c.id) + '" value="' + esc(c.name) + '" />' +
        (c.builtin ? "" : '<button class="danger-btn" type="button" data-act="delete-cat" data-id="' + esc(c.id) + '">Delete</button>') +
        "</div>";
    });
    html += '<button class="ghost-btn" type="button" data-act="add-cat" style="margin-top:10px">Add category</button></div>';
    html += '<div class="card"><h3>Reset</h3>' +
      '<button class="danger-btn" type="button" data-act="reset-data" style="margin-top:10px">Reset data</button></div>';
    html += "</div>";
    document.getElementById("view-settings").innerHTML = html;
  }

  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalFoot = document.getElementById("modal-footer");
  let modalContext = null;

  function openModal(title, body, foot, ctx) {
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modalFoot.innerHTML = foot || "";
    modalContext = ctx || null;
    if (!modal.open) modal.showModal();
  }

  function closeModal() {
    if (modal.open) modal.close();
    modalContext = null;
  }

  function field(label, inner, span2) {
    return '<label class="field' + (span2 ? " span-2" : "") + '">' + label + inner + "</label>";
  }

  function dayToggleHTML(selected) {
    const sel = selected || [];
    return '<div class="chip-row">' +
      S.WEEKDAYS.map(function (w, i) {
        return '<button type="button" class="day-chip' + (sel.indexOf(i) !== -1 ? " is-on" : "") + '" data-act="toggle-day" data-day="' + i + '">' + w + "</button>";
      }).join("") + "</div>";
  }

  function selectedDays() {
    return Array.from(modal.querySelectorAll(".day-chip.is-on")).map(function (b) { return Number(b.getAttribute("data-day")); });
  }

  function skipChip(d) {
    return '<span class="skip-chip" data-date="' + esc(d) + '">' + esc(d) + '<button type="button" data-act="remove-skip" data-date="' + esc(d) + '" aria-label="Remove">x</button></span>';
  }

  function skipEditor(dates) {
    const list = (dates || []).slice();
    return '<div class="span-2"><div class="sidebar-label">Skip dates</div>' +
      '<div class="skip-list" id="skip-list">' + list.map(skipChip).join("") + "</div>" +
      '<div class="row-actions" style="margin-top:8px"><input type="date" id="skip-add-date" />' +
      '<button class="ghost-btn" type="button" data-act="add-skip">Add skip</button></div></div>';
  }

  function gatherSkips() {
    return Array.from(modal.querySelectorAll("#skip-list .skip-chip")).map(function (x) { return x.getAttribute("data-date"); });
  }

  function categorySelect(id, selected) {
    return '<select id="' + id + '">' + S.get().categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === selected ? " selected" : "") + ">" + esc(c.name) + "</option>";
    }).join("") + "</select>";
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
  }

  function numOrNull(s) {
    if (s === "" || s == null) return null;
    const n = Number(s);
    return isNaN(n) ? null : n;
  }

  function openClassForm(existing) {
    const cls = existing || {
      name: "", shortName: "", days: [], startTime: "09:30", endTime: "10:45",
      startDate: (S.SPRING_2027 && S.SPRING_2027.start) || "", endDate: (S.SPRING_2027 && S.SPRING_2027.end) || "",
      location: "Broward College", notes: "",
      skipDates: (S.SPRING_2027 && S.SPRING_2027.daySkips.slice()) || [], categoryId: "cat-classes"
    };
    openModal(existing ? "Edit class" : "Add class",
      '<div class="form-grid">' +
        field("Class name", '<input type="text" id="f-name" value="' + esc(cls.name) + '" />', true) +
        field("Short title", '<input type="text" id="f-short" value="' + esc(cls.shortName || "") + '" placeholder="Shown on the month view" />') +
        field("Category", categorySelect("f-cat", cls.categoryId || "cat-classes")) +
        '<div class="span-2"><div class="sidebar-label">Days</div>' + dayToggleHTML(cls.days) + "</div>" +
        field("Start time", '<input type="time" id="f-start" value="' + esc(cls.startTime) + '" />') +
        field("End time", '<input type="time" id="f-end" value="' + esc(cls.endTime) + '" />') +
        field("Semester start", '<input type="date" id="f-from" value="' + esc(cls.startDate) + '" />') +
        field("Semester end", '<input type="date" id="f-to" value="' + esc(cls.endDate) + '" />') +
        field("Location", '<input type="text" id="f-loc" value="' + esc(cls.location || "") + '" />', true) +
        field("Notes", '<textarea id="f-notes">' + esc(cls.notes || "") + "</textarea>", true) +
        skipEditor(cls.skipDates) +
      "</div>",
      '<button class="ghost-btn" type="button" data-act="close-modal">Cancel</button>' +
      '<button class="primary-btn" type="button" data-act="save-class">Save class</button>',
      { type: "class", id: existing && existing.id }
    );
  }

  function saveClass() {
    const name = val("f-name").trim();
    const days = selectedDays();
    if (!name) return toast("Give the class a name.");
    if (!days.length) return toast("Pick at least one day.");
    const rec = {
      name: name,
      shortName: val("f-short").trim(),
      categoryId: val("f-cat") || "cat-classes",
      days: days,
      startTime: val("f-start") || "09:00",
      endTime: val("f-end") || "10:00",
      startDate: val("f-from"),
      endDate: val("f-to"),
      location: val("f-loc"),
      notes: val("f-notes"),
      skipDates: gatherSkips()
    };
    if (!rec.startDate || !rec.endDate) return toast("Add a start and end date.");
    S.update(function (data) {
      if (modalContext && modalContext.id) {
        const i = data.classes.findIndex(function (c) { return c.id === modalContext.id; });
        if (i >= 0) data.classes[i] = Object.assign({}, data.classes[i], rec);
      } else {
        rec.id = S.uid();
        data.classes.push(rec);
      }
    });
    closeModal();
    toast("Class saved.");
    render();
  }

  function openEventForm(existing, preset) {
    const ev = existing || {
      title: "", categoryId: (preset && preset.categoryId) || "cat-events", date: (preset && preset.date) || S.toDateStr(ui.cursor),
      startTime: (preset && preset.time) || "12:00", endTime: (preset && preset.end) || "13:00",
      allDay: false, location: "", notes: "",
      recurrence: null, skipDates: []
    };
    const rec = ev.recurrence || { freq: "none", days: ev.date ? [S.parseDateStr(ev.date).getDay()] : [], until: "", skipDates: [] };
    openModal(existing ? "Edit event" : "Add event",
      '<div class="form-grid">' +
        field("Title", '<input type="text" id="f-name" value="' + esc(ev.title) + '" />', true) +
        field("Category", categorySelect("f-cat", ev.categoryId || "cat-events")) +
        field("Date", '<input type="date" id="f-date" value="' + esc(ev.date) + '" />') +
        '<label class="field check-row span-2" style="flex-direction:row;align-items:center"><input type="checkbox" id="f-allday"' + (ev.allDay ? " checked" : "") + " /> All day</label>" +
        field("Start", '<input type="time" id="f-start" value="' + esc(ev.startTime || "") + '" />') +
        field("End", '<input type="time" id="f-end" value="' + esc(ev.endTime || "") + '" />') +
        field("Location", '<input type="text" id="f-loc" value="' + esc(ev.location || "") + '" />', true) +
        field("Notes", '<textarea id="f-notes">' + esc(ev.notes || "") + "</textarea>", true) +
        field("Repeats", '<select id="f-freq"><option value="none"' + (!ev.recurrence ? " selected" : "") + ">Does not repeat</option>" +
          '<option value="weekly"' + (rec.freq === "weekly" ? " selected" : "") + ">Weekly</option>" +
          '<option value="daily"' + (rec.freq === "daily" ? " selected" : "") + ">Daily</option></select>") +
        field("Until (for repeats)", '<input type="date" id="f-until" value="' + esc((ev.recurrence && ev.recurrence.until) || "") + '" />') +
        '<div class="span-2"><div class="sidebar-label">Repeat on</div>' + dayToggleHTML(rec.days) + "</div>" +
        skipEditor([].concat(ev.skipDates || [], (ev.recurrence && ev.recurrence.skipDates) || [])) +
      "</div>",
      '<button class="ghost-btn" type="button" data-act="close-modal">Cancel</button>' +
      (existing ? '<button class="danger-btn" type="button" data-act="delete-event">Delete</button>' : "") +
      '<button class="primary-btn" type="button" data-act="save-event">Save event</button>',
      { type: "event", id: existing && existing.id }
    );
  }

  function saveEvent() {
    const title = val("f-name").trim();
    if (!title) return toast("Give the event a title.");
    const date = val("f-date");
    if (!date) return toast("Pick a date.");
    const freq = val("f-freq");
    const rec = freq === "none" ? null : {
      freq: freq,
      days: freq === "weekly" ? selectedDays() : [],
      until: val("f-until") || "",
      skipDates: []
    };
    if (rec && rec.freq === "weekly" && !rec.days.length) rec.days = [S.parseDateStr(date).getDay()];
    const ev = {
      title: title,
      categoryId: val("f-cat") || "cat-events",
      date: date,
      startTime: val("f-start"),
      endTime: val("f-end"),
      allDay: document.getElementById("f-allday").checked,
      location: val("f-loc"),
      notes: val("f-notes"),
      recurrence: rec,
      skipDates: gatherSkips()
    };
    S.update(function (data) {
      if (modalContext && modalContext.id) {
        const i = data.events.findIndex(function (e) { return e.id === modalContext.id; });
        if (i >= 0) data.events[i] = Object.assign({}, data.events[i], ev);
      } else {
        ev.id = S.uid();
        data.events.push(ev);
      }
    });
    closeModal();
    toast("Event saved.");
    render();
  }

  function openTaskForm(existing) {
    const t = existing || { title: "", classId: "", dueDate: S.toDateStr(ui.cursor), dueTime: "", notes: "", done: false, categoryId: "cat-classes" };
    const opts = '<option value="">No class</option>' + S.get().classes.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === t.classId ? " selected" : "") + ">" + esc(c.name) + "</option>";
    }).join("");
    openModal(existing ? "Edit homework" : "Add homework",
      '<div class="form-grid">' +
        field("Title", '<input type="text" id="f-name" value="' + esc(t.title) + '" />', true) +
        field("Class", '<select id="f-class">' + opts + "</select>", true) +
        field("Due date", '<input type="date" id="f-date" value="' + esc(t.dueDate || "") + '" />') +
        (existing ? '<label class="field check-row span-2" style="flex-direction:row;align-items:center"><input type="checkbox" id="f-done"' + (t.done ? " checked" : "") + " /> Done</label>" : "") +
      "</div>",
      '<button class="ghost-btn" type="button" data-act="close-modal">Cancel</button>' +
      (existing ? '<button class="danger-btn" type="button" data-act="delete-task">Delete</button>' : "") +
      '<button class="primary-btn" type="button" data-act="save-task">Save</button>',
      { type: "task", id: existing && existing.id }
    );
  }

  function saveTask() {
    const title = val("f-name").trim();
    if (!title) return toast("Give it a title.");
    const rec = {
      title: title,
      classId: val("f-class") || "",
      dueDate: val("f-date"),
      dueTime: "",
      notes: "",
      categoryId: "cat-classes",
      done: false
    };
    const doneEl = document.getElementById("f-done");
    if (doneEl) rec.done = !!doneEl.checked;
    S.update(function (data) {
      if (modalContext && modalContext.id) {
        const i = data.tasks.findIndex(function (t) { return t.id === modalContext.id; });
        if (i >= 0) {
          if (!doneEl) rec.done = data.tasks[i].done;
          data.tasks[i] = Object.assign({}, data.tasks[i], rec);
        }
      } else {
        rec.id = S.uid();
        data.tasks.push(rec);
      }
    });
    closeModal();
    toast("Homework saved.");
    render();
  }


  function openWorkoutLog(dateStr, name) {
    const date = dateStr || S.toDateStr(new Date());
    const existing = S.workoutForDate(date);
    const workout = existing ? JSON.parse(JSON.stringify(existing)) : { id: S.uid(), date: date, name: name || "Workout", exercises: [] };
    if (!workout.exercises.length) workout.exercises.push({ id: S.uid(), name: "", sets: [{ reps: "", weight: "" }] });
    modalContext = { type: "workout", workout: workout };
    paintWorkoutModal();
  }

  function paintWorkoutModal() {
    const w = modalContext.workout;
    let body = field("Date", '<input type="date" id="w-date" value="' + esc(w.date) + '" />') +
      field("Session name", '<input type="text" id="w-name" value="' + esc(w.name || "") + '" />', true);
    w.exercises.forEach(function (ex, i) {
      body += '<div class="ex-card" data-ex="' + i + '"><div class="card-top"><label class="field" style="flex:1">Exercise' +
        '<input type="text" class="ex-name" value="' + esc(ex.name) + '" /></label>' +
        '<button class="text-btn" type="button" data-act="remove-ex" data-i="' + i + '">Remove</button></div>';
      body += '<div class="set-grid muted" style="font-size:12px;margin-top:8px"><span>#</span><span>Reps</span><span>Weight</span><span></span></div>';
      (ex.sets || []).forEach(function (set, s) {
        body += '<div class="set-grid"><span class="muted">' + (s + 1) + "</span>" +
          '<input type="number" min="0" class="set-reps" data-ex="' + i + '" data-set="' + s + '" value="' + esc(set.reps) + '" />' +
          '<input type="number" min="0" step="0.5" class="set-wt" data-ex="' + i + '" data-set="' + s + '" value="' + esc(set.weight) + '" />' +
          '<button class="text-btn" type="button" data-act="remove-set" data-ex="' + i + '" data-set="' + s + '">x</button></div>';
      });
      body += '<div class="row-actions" style="margin-top:8px"><button class="ghost-btn" type="button" data-act="add-set" data-i="' + i + '">Add set</button>' +
        (ex.name ? '<button class="text-btn" type="button" data-act="ex-history" data-name="' + esc(ex.name) + '">Progress</button>' : "") +
        "</div></div>";
    });
    body += '<button class="ghost-btn" type="button" data-act="add-ex">Add exercise</button>';
    openModal("Workout log", body,
      '<button class="ghost-btn" type="button" data-act="close-modal">Cancel</button>' +
      '<button class="primary-btn" type="button" data-act="save-workout">Save log</button>',
      modalContext
    );
  }

  function scoopWorkout() {
    const w = modalContext.workout;
    w.date = val("w-date") || w.date;
    w.name = val("w-name") || "Workout";
    modal.querySelectorAll(".ex-card").forEach(function (card) {
      const i = Number(card.getAttribute("data-ex"));
      if (!w.exercises[i]) return;
      const name = card.querySelector(".ex-name");
      if (name) w.exercises[i].name = name.value;
    });
    modal.querySelectorAll(".set-reps").forEach(function (inp) {
      const i = Number(inp.getAttribute("data-ex")), s = Number(inp.getAttribute("data-set"));
      if (w.exercises[i] && w.exercises[i].sets[s]) w.exercises[i].sets[s].reps = inp.value;
    });
    modal.querySelectorAll(".set-wt").forEach(function (inp) {
      const i = Number(inp.getAttribute("data-ex")), s = Number(inp.getAttribute("data-set"));
      if (w.exercises[i] && w.exercises[i].sets[s]) w.exercises[i].sets[s].weight = inp.value;
    });
  }

  function saveWorkout() {
    scoopWorkout();
    const w = modalContext.workout;
    w.exercises = (w.exercises || []).filter(function (ex) { return ex.name && ex.name.trim(); });
    S.update(function (data) {
      const i = data.workouts.findIndex(function (x) { return x.date === w.date; });
      if (i >= 0) data.workouts[i] = w;
      else data.workouts.push(w);
    });
    closeModal();
    toast("Workout saved.");
    render();
  }

  function openExerciseHistory(name) {
    const rows = S.exerciseHistory(name);
    let body = "";
    if (!rows.length) body = '<p class="empty-note">No history for ' + esc(name) + " yet.</p>";
    else {
      const vols = rows.map(function (r) {
        return (r.sets || []).reduce(function (sum, s) { return sum + (Number(s.reps) || 0) * (Number(s.weight) || 0); }, 0);
      });
      body += sparkSVG(vols);
      rows.slice().reverse().forEach(function (r) {
        const sets = (r.sets || []).map(function (s) { return (s.reps || "-") + " x " + (s.weight || "-"); }).join(", ");
        body += '<div class="history-row"><span>' + esc(S.formatDateNice(r.date)) + "</span><span>" + esc(sets) + "</span></div>";
      });
    }
    openModal(name + " progress", body, '<button class="primary-btn" type="button" data-act="close-modal">Close</button>', { type: "history" });
  }

  function sparkSVG(values) {
    if (values.length < 2) return "";
    const w = 480, h = 64, p = 4;
    const max = Math.max.apply(null, values.concat([1]));
    const pts = values.map(function (v, i) {
      const x = p + i * (w - p * 2) / (values.length - 1);
      const y = h - p - (v / max) * (h - p * 2);
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" stroke-width="2" points="' + pts + '" /></svg>';
  }

  function openAddChooser() {
    openModal("Add",
      '<div class="onboard-actions">' +
        '<button class="primary-btn" type="button" data-act="add-event">Event</button>' +
        '<button class="secondary-btn" type="button" data-act="add-class">Class</button>' +
        '<button class="secondary-btn" type="button" data-act="add-task">Homework</button>' +
        '<button class="secondary-btn" type="button" data-act="log-workout">Workout log</button>' +
      "</div>",
      '<button class="ghost-btn" type="button" data-act="close-modal">Cancel</button>'
    );
  }

  function findOcc(id) {
    const now = ui.cursor;
    const wide = S.getOccurrencesInRange(S.addDays(now, -200), S.addDays(now, 400), { hiddenCats: new Set() });
    return wide.find(function (x) { return x.id === id; }) || null;
  }

  function openOccurrence(id) {
    const occ = findOcc(id);
    if (!occ) return;
    if (occ.source === "task") {
      const t = S.get().tasks.find(function (x) { return x.id === occ.taskId; });
      if (t) return openTaskForm(t);
    }
    const bits = [
      "<p><strong>" + esc(timeLabel(occ)) + "</strong> · " + esc(S.formatDateNice(occ.date)) + "</p>",
      "<p class='muted'>" + esc(catName(occ.categoryId) + (occ.location ? " · " + occ.location : "")) + "</p>",
      occ.notes ? "<p>" + esc(occ.notes) + "</p>" : ""
    ].join("");
    let foot = '<button class="ghost-btn" type="button" data-act="close-modal">Close</button>';
    if (occ.source === "class") {
      foot += '<button class="secondary-btn" type="button" data-act="skip-occ" data-kind="class" data-id="' + esc(occ.classId) + '" data-date="' + esc(occ.date) + '">Skip this day</button>';
      foot += '<button class="primary-btn" type="button" data-act="edit-class" data-id="' + esc(occ.classId) + '">Edit class</button>';
    } else if (occ.source === "gym") {
      foot += '<button class="secondary-btn" type="button" data-act="skip-occ" data-kind="gym" data-date="' + esc(occ.date) + '">Skip this day</button>';
      foot += '<button class="primary-btn" type="button" data-act="log-workout" data-date="' + esc(occ.date) + '" data-name="' + esc(occ.title) + '">Log workout</button>';
    } else if (occ.source === "event") {
      foot += '<button class="secondary-btn" type="button" data-act="skip-occ" data-kind="event" data-id="' + esc(occ.eventId) + '" data-date="' + esc(occ.date) + '">Skip this day</button>';
      foot += '<button class="primary-btn" type="button" data-act="edit-event" data-id="' + esc(occ.eventId) + '">Edit event</button>';
    }
    openModal(occ.title, bits, foot, { type: "occ", occ: occ });
  }

  /* ---- Pass #3: Google Calendar-style preview popover for calendar blocks ---- */
  const peek = { open: false, id: "", at: 0 };

  function canPeek(anchor) {
    if (!anchor || !anchor.closest("#calendar-board")) return false;
    if (window.innerWidth < 720) return false;
    return !(window.matchMedia && window.matchMedia("(hover: none)").matches);
  }

  function peekHTML(occ) {
    const d = S.parseDateStr(occ.date);
    const dateBit = S.WEEKDAYS[d.getDay()] + ", " + S.MONTHS[d.getMonth()] + " " + d.getDate();
    const when = occ.allDay || !occ.startTime ? dateBit + " · All day" : dateBit + " · " + timeLabel(occ);
    let task = null;
    if (occ.source === "task") task = S.get().tasks.find(function (x) { return x.id === occ.taskId; }) || null;
    const meta = [catName(occ.categoryId)];
    if (occ.location) meta.push(occ.location);
    if (task) meta.push(task.done ? "Done" : "Not done");
    let html = '<div class="pk-head"><span class="pk-sw" style="--c:' + esc(catColor(occ.categoryId)) + '"></span>' +
      '<h3 class="pk-title">' + esc(occ.title) + "</h3>" +
      '<button type="button" class="icon-btn pk-x" data-pk="close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>';
    html += '<p class="pk-when">' + esc(when) + "</p>";
    html += '<p class="pk-meta">' + esc(meta.join(" · ")) + "</p>";
    if (occ.notes) html += '<p class="pk-notes">' + esc(occ.notes) + "</p>";
    html += '<div class="pk-actions">';
    if (task) {
      html += '<button class="ghost-btn" type="button" data-act="toggle-task" data-id="' + esc(task.id) + '">' + (task.done ? "Mark not done" : "Mark done") + "</button>";
      html += '<button class="primary-btn" type="button" data-act="edit-task" data-id="' + esc(task.id) + '">Edit</button>';
    } else if (occ.source === "class") {
      html += '<button class="ghost-btn" type="button" data-act="skip-occ" data-kind="class" data-id="' + esc(occ.classId) + '" data-date="' + esc(occ.date) + '">Skip this day</button>';
      html += '<button class="primary-btn" type="button" data-act="edit-class" data-id="' + esc(occ.classId) + '">Edit class</button>';
    } else if (occ.source === "gym") {
      html += '<button class="ghost-btn" type="button" data-act="skip-occ" data-kind="gym" data-date="' + esc(occ.date) + '">Skip this day</button>';
      html += '<button class="primary-btn" type="button" data-act="log-workout" data-date="' + esc(occ.date) + '" data-name="' + esc(occ.title) + '">Log workout</button>';
    } else if (occ.source === "event") {
      html += '<button class="ghost-btn" type="button" data-act="skip-occ" data-kind="event" data-id="' + esc(occ.eventId) + '" data-date="' + esc(occ.date) + '">Skip this day</button>';
      html += '<button class="primary-btn" type="button" data-act="edit-event" data-id="' + esc(occ.eventId) + '">Edit event</button>';
    } else {
      html += '<button class="primary-btn" type="button" data-pk="details">Details</button>';
    }
    html += "</div>";
    return html;
  }

  function placePeek(anchor) {
    const el = document.getElementById("peek");
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight, gap = 10;
    let left, origin;
    if (r.right + gap + w <= vw - 8) { left = r.right + gap; origin = "left"; }
    else if (r.left - gap - w >= 8) { left = r.left - gap - w; origin = "right"; }
    else { left = Math.max(8, Math.min(r.left, vw - w - 8)); origin = "center"; }
    const top = Math.max(64, Math.min(r.top, vh - h - 12));
    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top) + "px";
    el.style.transformOrigin = origin + " top";
  }

  function openPeek(id, anchor) {
    const occ = findOcc(id);
    if (!occ) return;
    if (peek.open && peek.id === id) { closePeek(); return; }
    closePicker();
    const el = document.getElementById("peek");
    el.innerHTML = peekHTML(occ);
    el.hidden = false;
    peek.open = true;
    peek.id = id;
    peek.at = Date.now();
    document.querySelectorAll(".is-peeked").forEach(function (b) { b.classList.remove("is-peeked"); });
    anchor.classList.add("is-peeked");
    placePeek(anchor);
    el.classList.remove("is-in");
    void el.offsetWidth;
    el.classList.add("is-in");
  }

  function closePeek() {
    if (!peek.open) return;
    peek.open = false;
    peek.id = "";
    document.getElementById("peek").hidden = true;
    document.querySelectorAll(".is-peeked").forEach(function (b) { b.classList.remove("is-peeked"); });
  }

  function bindPeek() {
    const el = document.getElementById("peek");
    el.addEventListener("click", function (e) {
      const b = e.target.closest("[data-pk]");
      if (b) {
        e.stopPropagation();
        const id = peek.id;
        closePeek();
        if (b.getAttribute("data-pk") === "details") openOccurrence(id);
        return;
      }
      if (e.target.closest("[data-act]")) closePeek();
    }, true);
    document.addEventListener("click", function (e) {
      if (peek.open && !el.contains(e.target) && !e.target.closest("[data-act='open-occ']")) closePeek();
    });
    window.addEventListener("resize", closePeek);
    document.addEventListener("scroll", function (e) {
      if (peek.open && !el.contains(e.target) && Date.now() - peek.at > 250) closePeek();
    }, true);
  }

  function skipOcc(kind, id, date) {
    S.update(function (data) {
      if (kind === "class") {
        const c = data.classes.find(function (x) { return x.id === id; });
        if (c) { c.skipDates = c.skipDates || []; if (c.skipDates.indexOf(date) === -1) c.skipDates.push(date); }
      } else if (kind === "gym" && data.gymPlan) {
        data.gymPlan.skipDates = data.gymPlan.skipDates || [];
        if (data.gymPlan.skipDates.indexOf(date) === -1) data.gymPlan.skipDates.push(date);
      } else if (kind === "event") {
        const ev = data.events.find(function (x) { return x.id === id; });
        if (ev) { ev.skipDates = ev.skipDates || []; if (ev.skipDates.indexOf(date) === -1) ev.skipDates.push(date); }
      }
    });
    closeModal();
    toast("Skipped " + date + ".");
    render();
  }

  function onClick(e) {
    const t = e.target.closest("[data-act]");
    if (!t) {
      if (e.target === modal) closeModal();
      return;
    }
    const act = t.getAttribute("data-act");
    if (act === "go" || act === "go-home") {
      const page = act === "go-home" ? "home" : (t.getAttribute("data-page") || "home");
      if (t.classList.contains("hub-node") && (t.classList.contains("is-press") || isCoarsePointer())) {
        if (t.getAttribute("data-animating") === "1") return;
        t.setAttribute("data-animating", "1");
        t.classList.add("is-press");
        const wait = Math.max(80, 230 - (Date.now() - (hubPressAt || 0)));
        setTimeout(function () {
          t.classList.remove("is-press");
          t.removeAttribute("data-animating");
          ui.page = page;
          render();
        }, wait);
        return;
      }
      ui.page = page;
      render();
      return;
    }
    if (act === "open-occ") {
      e.preventDefault();
      e.stopPropagation();
      if (canPeek(t)) openPeek(t.getAttribute("data-id"), t);
      else openOccurrence(t.getAttribute("data-id"));
      return;
    }
    if (act === "toggle-classes") {
      e.preventDefault();
      e.stopPropagation();
      const ds = t.getAttribute("data-date");
      if (ui.openClassDays.has(ds)) ui.openClassDays.delete(ds);
      else ui.openClassDays.add(ds);
      ui.revealDay = ds;
      render();
      ui.revealDay = "";
      return;
    }
    if (act === "open-day") {
      e.preventDefault();
      ui.cursor = S.parseDateStr(t.getAttribute("data-date"));
      if (ui.page === "calendar" && ui.mode !== "day") ui.boardAnim = "swap";
      ui.mode = "day";
      ui.page = "calendar";
      render();
      return;
    }
    if (act === "add-at") {
      if (e.target.closest(".evt-block")) return;
      const cal = t.closest(".time-cal");
      const visStart = cal ? Number(cal.getAttribute("data-vis-start")) : 7 * 60 + 30;
      const visEnd = cal ? Number(cal.getAttribute("data-vis-end")) : 22 * 60 + 30;
      const rect = t.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
      const mins = Math.max(0, Math.min(24 * 60 - 30, Math.round((visStart + frac * (visEnd - visStart)) / 15) * 15));
      const time = S.pad(Math.floor(mins / 60)) + ":" + S.pad(mins % 60);
      const end = mins + 60;
      const endTime = S.pad(Math.floor(end / 60) % 24) + ":" + S.pad(end % 60);
      openEventForm(null, { date: t.getAttribute("data-date"), time: time, end: endTime });
      return;
    }
    if (act === "toggle-cat") {
      const id = t.getAttribute("data-id");
      if (ui.hiddenCats.has(id)) ui.hiddenCats.delete(id);
      else ui.hiddenCats.add(id);
      render();
      return;
    }
    if (act === "toggle-day") { t.classList.toggle("is-on"); return; }
    if (act === "add-skip") {
      const inp = document.getElementById("skip-add-date");
      if (inp && inp.value) {
        const list = document.getElementById("skip-list");
        if (list && !list.querySelector('[data-date="' + inp.value + '"]')) list.insertAdjacentHTML("beforeend", skipChip(inp.value));
        inp.value = "";
      }
      return;
    }
    if (act === "remove-skip") {
      const chip = t.closest(".skip-chip");
      if (chip) chip.remove();
      return;
    }
    if (act === "close-modal") { closeModal(); return; }
    if (act === "add-class") { openClassForm(null); return; }
    if (act === "edit-class") {
      const cls = S.get().classes.find(function (c) { return c.id === t.getAttribute("data-id"); });
      if (cls) openClassForm(cls);
      return;
    }
    if (act === "save-class") { saveClass(); return; }
    if (act === "delete-class") {
      if (!window.confirm("Remove this class from the calendar?")) return;
      const id = t.getAttribute("data-id");
      S.update(function (d) { d.classes = d.classes.filter(function (c) { return c.id !== id; }); });
      closeModal();
      render();
      return;
    }
    if (act === "add-event") { openEventForm(null, { categoryId: t.getAttribute("data-cat") || undefined }); return; }
    if (act === "edit-event") {
      const ev = S.get().events.find(function (c) { return c.id === t.getAttribute("data-id"); });
      if (ev) openEventForm(ev);
      return;
    }
    if (act === "save-event") { saveEvent(); return; }
    if (act === "delete-event") {
      if (!window.confirm("Delete this event?")) return;
      const id = modalContext && modalContext.id;
      S.update(function (d) { d.events = d.events.filter(function (c) { return c.id !== id; }); });
      closeModal();
      render();
      return;
    }
    if (act === "add-task") { openTaskForm(null); return; }
    if (act === "edit-task") {
      const task = S.get().tasks.find(function (c) { return c.id === t.getAttribute("data-id"); });
      if (task) openTaskForm(task);
      return;
    }
    if (act === "save-task") { saveTask(); return; }
    if (act === "delete-task") {
      const id = modalContext && modalContext.id;
      S.update(function (d) { d.tasks = d.tasks.filter(function (c) { return c.id !== id; }); });
      closeModal();
      render();
      return;
    }
    if (act === "toggle-task") {
      const id = t.getAttribute("data-id");
      S.update(function (d) {
        const task = d.tasks.find(function (c) { return c.id === id; });
        if (task) task.done = !task.done;
      });
      render();
      return;
    }
    if (act === "task-filter") { ui.taskFilter = t.getAttribute("data-filter"); render(); return; }
    if (act === "gym-week") {
      const dir = Number(t.getAttribute("data-dir"));
      if (dir === 0) ui.gymWeek = S.startOfGymWeek(new Date());
      else {
        const cur = S.startOfGymWeek(ui.gymWeek || new Date());
        ui.gymWeek = S.addDays(cur, 7 * dir);
      }
      render();
      return;
    }
    if (act === "gym-assign") {
      assignGymSession(t.getAttribute("data-session"), t.getAttribute("data-date"));
      return;
    }
    if (act === "gym-edit") {
      openGymSlotEditor(t.getAttribute("data-session"), t.getAttribute("data-date"));
      return;
    }
    if (act === "gym-unassign") {
      unassignGymSession(t.getAttribute("data-session"), t.getAttribute("data-date"));
      closeModal();
      return;
    }
    if (act === "save-gym-time") {
      const startT = val("g-start");
      let endT = val("g-end");
      if (startT && !endT) {
        const m = S.minutesSinceMidnight(startT) + 60;
        endT = S.pad(Math.floor(m / 60) % 24) + ":" + S.pad(m % 60);
      }
      saveGymSlotTime(t.getAttribute("data-session"), t.getAttribute("data-date"), startT, endT);
      closeModal();
      return;
    }
    if (act === "log-workout") {
      openWorkoutLog(t.getAttribute("data-date"), t.getAttribute("data-name"));
      return;
    }
    if (act === "add-ex") {
      scoopWorkout();
      modalContext.workout.exercises.push({ id: S.uid(), name: "", sets: [{ reps: "", weight: "" }] });
      paintWorkoutModal();
      return;
    }
    if (act === "remove-ex") {
      scoopWorkout();
      modalContext.workout.exercises.splice(Number(t.getAttribute("data-i")), 1);
      paintWorkoutModal();
      return;
    }
    if (act === "add-set") {
      scoopWorkout();
      modalContext.workout.exercises[Number(t.getAttribute("data-i"))].sets.push({ reps: "", weight: "" });
      paintWorkoutModal();
      return;
    }
    if (act === "remove-set") {
      scoopWorkout();
      const ex = modalContext.workout.exercises[Number(t.getAttribute("data-ex"))];
      ex.sets.splice(Number(t.getAttribute("data-set")), 1);
      if (!ex.sets.length) ex.sets.push({ reps: "", weight: "" });
      paintWorkoutModal();
      return;
    }
    if (act === "save-workout") { saveWorkout(); return; }
    if (act === "ex-history") { openExerciseHistory(t.getAttribute("data-name")); return; }
    if (act === "skip-occ") {
      skipOcc(t.getAttribute("data-kind"), t.getAttribute("data-id"), t.getAttribute("data-date"));
      return;
    }
    if (act === "add-cat") {
      const name = window.prompt("Category name?");
      if (!name) return;
      S.update(function (d) {
        d.categories.push({ id: S.uid(), name: name.trim(), color: "#7C6BCD", builtin: false, kind: "custom" });
      });
      render();
      return;
    }
    if (act === "delete-cat") {
      const id = t.getAttribute("data-id");
      S.update(function (d) {
        d.categories = d.categories.filter(function (c) { return c.id !== id; });
        d.events.forEach(function (ev) { if (ev.categoryId === id) ev.categoryId = "cat-events"; });
      });
      render();
      return;
    }
    if (act === "reset-data") {
      if (!window.confirm("Reset llc to the preloaded Fall 2026 and Spring 2027 schedules? This clears gym logs, tasks, and edits on this device.")) return;
      S.clearAll();
      ui.cursor = initialCursor();
      render();
      toast("Restored the preloaded schedules.");
      return;
    }
  }

  function closeSidebar() {
    ui.sidebarOpen = false;
    document.getElementById("sidebar").classList.remove("is-open");
    document.getElementById("sidebar-backdrop").hidden = true;
  }

  function finishOnboard() {
    S.update(function (d) { d.onboarded = true; });
    const dlg = document.getElementById("onboarding");
    if (dlg.open) dlg.close();
  }

  let hubPressAt = 0;

  function isCoarsePointer() {
    return window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches;
  }

  function startHubMotion() {
    const hub = document.getElementById("hub");
    if (!hub || hubMotion.running) return;
    hubMotion.running = true;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = isCoarsePointer();
    const nodeEls = Array.prototype.slice.call(hub.querySelectorAll(".hub-node"));

    function measureRest() {
      nodeEls.forEach(function (el) {
        el.style.setProperty("--mx", "0px");
        el.style.setProperty("--my", "0px");
      });
      hubMotion.nodes = nodeEls.map(function (el) {
        const r = el.getBoundingClientRect();
        return {
          el: el,
          name: el.getAttribute("data-spoke") || "",
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          mx: 0,
          my: 0
        };
      });
    }

    function updateSpokes() {
      const svg = hub.querySelector(".hub-spokes");
      if (!svg) return;
      const hr = hub.getBoundingClientRect();
      svg.setAttribute("viewBox", "0 0 " + hr.width + " " + hr.height);
      svg.setAttribute("width", String(hr.width));
      svg.setAttribute("height", String(hr.height));
      const cal = hubMotion.nodes.filter(function (n) { return n.name === "calendar"; })[0];
      if (!cal) return;
      const calX = cal.cx + cal.mx - hr.left;
      const calY = cal.cy + cal.my - hr.top;
      ["school", "events", "personal", "gym"].forEach(function (name) {
        const n = hubMotion.nodes.filter(function (x) { return x.name === name; })[0];
        const line = svg.querySelector('line[data-spoke="' + name + '"]');
        if (!n || !line) return;
        line.setAttribute("x1", String(calX));
        line.setAttribute("y1", String(calY));
        line.setAttribute("x2", String(n.cx + n.mx - hr.left));
        line.setAttribute("y2", String(n.cy + n.my - hr.top));
      });
    }

    function tick() {
      if (!hubMotion.running) return;
      const MAGNET_R = 120;
      const MAX_D = 9;
      const LERP = 0.1;
      if (!reduced && !coarse) {
        hubMotion.nodes.forEach(function (n) {
          let tx = 0, ty = 0;
          if (hubMotion.mouse.inside) {
            const dx = hubMotion.mouse.x - n.cx;
            const dy = hubMotion.mouse.y - n.cy;
            const dist = Math.hypot(dx, dy);
            if (dist < MAGNET_R && dist > 0.01) {
              const pull = MAX_D * (1 - dist / MAGNET_R);
              tx = (dx / dist) * pull;
              ty = (dy / dist) * pull;
            }
          }
          n.mx += (tx - n.mx) * LERP;
          n.my += (ty - n.my) * LERP;
          if (Math.abs(n.mx) < 0.05) n.mx = 0;
          if (Math.abs(n.my) < 0.05) n.my = 0;
          n.el.style.setProperty("--mx", n.mx + "px");
          n.el.style.setProperty("--my", n.my + "px");
        });
      }
      updateSpokes();
      hubMotion.raf = requestAnimationFrame(tick);
    }

    measureRest();
    updateSpokes();
    hubMotion.onMove = function (e) {
      if (e.pointerType === "touch" || e.pointerType === "pen") return;
      if (coarse || reduced) return;
      hubMotion.mouse.x = e.clientX;
      hubMotion.mouse.y = e.clientY;
      const hr = hub.getBoundingClientRect();
      const pad = 140;
      hubMotion.mouse.inside = e.clientX >= hr.left - pad && e.clientX <= hr.right + pad && e.clientY >= hr.top - pad && e.clientY <= hr.bottom + pad;
    };
    hubMotion.onResize = function () { measureRest(); updateSpokes(); };
    window.addEventListener("pointermove", hubMotion.onMove, { passive: true });
    window.addEventListener("resize", hubMotion.onResize);
    hubMotion.raf = requestAnimationFrame(tick);
  }

  function stopHubMotion() {
    if (!hubMotion.running) return;
    hubMotion.running = false;
    if (hubMotion.raf) cancelAnimationFrame(hubMotion.raf);
    hubMotion.raf = 0;
    if (hubMotion.onMove) window.removeEventListener("pointermove", hubMotion.onMove);
    if (hubMotion.onResize) window.removeEventListener("resize", hubMotion.onResize);
    hubMotion.onMove = null;
    hubMotion.onResize = null;
  }

  function bindHubPress() {
    document.addEventListener("pointerdown", function (e) {
      const node = e.target.closest && e.target.closest(".hub-node");
      if (!node) return;
      if (e.pointerType === "touch" || e.pointerType === "pen") {
        node.classList.add("is-press");
        hubPressAt = Date.now();
      }
    });
    document.addEventListener("pointercancel", function (e) {
      const node = e.target.closest && e.target.closest(".hub-node");
      if (node) node.classList.remove("is-press");
    });
  }

  function bind() {
    document.addEventListener("click", onClick);
    bindHubPress();
    document.addEventListener("dragstart", function (e) {
      const lab = e.target.closest && e.target.closest("[data-gym-drag]");
      if (!lab) return;
      e.dataTransfer.setData("text/plain", lab.getAttribute("data-session") || lab.getAttribute("data-gym-drag"));
      e.dataTransfer.effectAllowed = "move";
    });
    document.addEventListener("dragover", function (e) {
      const cell = e.target.closest && e.target.closest("[data-act='gym-assign'], [data-act='gym-edit']");
      if (!cell) return;
      e.preventDefault();
      cell.classList.add("is-drop");
    });
    document.addEventListener("dragleave", function (e) {
      const cell = e.target.closest && e.target.closest(".cell");
      if (cell) cell.classList.remove("is-drop");
    });
    document.addEventListener("drop", function (e) {
      const cell = e.target.closest && e.target.closest("[data-act='gym-assign'], [data-act='gym-edit']");
      if (!cell) return;
      e.preventDefault();
      cell.classList.remove("is-drop");
      const session = e.dataTransfer.getData("text/plain");
      const date = cell.getAttribute("data-date");
      if (session && date) assignGymSession(session, date);
    });
    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.addEventListener("click", function () { ui.page = b.getAttribute("data-page"); render(); });
    });
    document.getElementById("view-switch").addEventListener("click", function (e) {
      const b = e.target.closest("[data-mode]");
      if (!b) return;
      setMode(b.getAttribute("data-mode"));
    });
    document.getElementById("prev-btn").addEventListener("click", function () { shiftPeriod(-1); });
    document.getElementById("next-btn").addEventListener("click", function () { shiftPeriod(1); });
    document.getElementById("today-btn").addEventListener("click", function () { goToDate(new Date()); });
    bindPicker();
    bindPeek();
    document.getElementById("home-btn").addEventListener("click", function () { ui.page = "home"; render(); });
    document.getElementById("add-btn").addEventListener("click", openAddChooser);
    document.getElementById("menu-btn").addEventListener("click", function () {
      ui.sidebarOpen = !ui.sidebarOpen;
      document.getElementById("sidebar").classList.toggle("is-open", ui.sidebarOpen);
      document.getElementById("sidebar-backdrop").hidden = !ui.sidebarOpen;
    });
    document.getElementById("sidebar-backdrop").addEventListener("click", closeSidebar);
    document.getElementById("modal-close").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

    document.addEventListener("change", function (e) {
      if (e.target && e.target.getAttribute("data-act") === "cat-color") {
        const id = e.target.getAttribute("data-id");
        const color = e.target.value;
        S.update(function (d) { const c = d.categories.find(function (x) { return x.id === id; }); if (c) c.color = color; });
        render();
      }
      if (e.target && e.target.getAttribute("data-act") === "cat-name") {
        const id = e.target.getAttribute("data-id");
        const name = e.target.value.trim();
        if (!name) return;
        S.update(function (d) { const c = d.categories.find(function (x) { return x.id === id; }); if (c) c.name = name; });
      }
    });

    document.getElementById("onboard-classes").addEventListener("click", function () {
      finishOnboard();
      ui.page = "classes";
      render();
    });
    document.getElementById("onboard-gym").addEventListener("click", function () {
      finishOnboard();
      ui.page = "gym";
      render();
    });
    document.getElementById("onboard-skip").addEventListener("click", finishOnboard);

    /* Keyboard shortcuts (Google Calendar / Notion Calendar style). */
    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable)) return;
      if (modal.open) return;
      if (picker.open && e.key === "Escape") { closePicker(); return; }
      if (peek.open && e.key === "Escape") { closePeek(); return; }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const onCal = ui.page === "calendar";
      let hit = true;
      if (k === "t") goToDate(new Date());
      else if (k === "m" || k === "1") setMode("month");
      else if (k === "w" || k === "2") setMode("week");
      else if (k === "d" || k === "3") setMode("day");
      else if (onCal && (k === "ArrowLeft" || k === "k" || k === "p")) shiftPeriod(-1);
      else if (onCal && (k === "ArrowRight" || k === "j" || k === "n")) shiftPeriod(1);
      else if (onCal && k === "g") { if (picker.open) closePicker(); else openPicker(); }
      else if (k === "c" && ui.page !== "home") openAddChooser();
      else hit = false;
      if (hit) e.preventDefault();
    });
  }

  /* Google/Notion Calendar-style hover slot: a faint 1-hour outline with its start time follows the pointer
     over empty space in week/day, snapped to 15 minutes, showing exactly where a click will create an event. */
  function bindSlotGhost() {
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const board = document.getElementById("calendar-board");
    let col = null, ghost = null, lastKey = "";
    function hide() {
      if (ghost) ghost.classList.remove("is-on");
      lastKey = "";
    }
    board.addEventListener("pointermove", function (e) {
      const c = e.target.closest(".day-col");
      if (!c || e.target.closest(".evt-block, .cls-rail") || modal.open || peek.open) { hide(); return; }
      const cal = c.closest(".time-cal");
      const visStart = Number(cal.getAttribute("data-vis-start"));
      const visEnd = Number(cal.getAttribute("data-vis-end"));
      const span = Math.max(60, visEnd - visStart);
      const rect = c.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
      const mins = Math.max(0, Math.min(24 * 60 - 30, Math.round((visStart + frac * span) / 15) * 15));
      const top = Math.max(visStart, Math.min(mins, visEnd - 60));
      if (c !== col || !ghost || !c.contains(ghost)) {
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        col = c;
        ghost = document.createElement("div");
        ghost.className = "slot-ghost";
        ghost.setAttribute("aria-hidden", "true");
        ghost.innerHTML = '<span class="sg-t"></span>';
        c.appendChild(ghost);
        lastKey = "";
      }
      const h = (60 / span) * rect.height;
      ghost.style.height = Math.max(14, h - 2) + "px";
      const key = c.getAttribute("data-date") + mins;
      if (key === lastKey) return;
      lastKey = key;
      ghost.firstChild.textContent = S.formatGCalTime(S.pad(Math.floor(mins / 60)) + ":" + S.pad(mins % 60));
      ghost.style.transform = "translateY(" + (((top - visStart) / span) * rect.height) + "px)";
      if (!ghost.classList.contains("is-on")) {
        void ghost.offsetWidth;
        ghost.classList.add("is-on");
      }
    });
    board.addEventListener("pointerleave", hide);
    board.addEventListener("pointerdown", hide);
  }

  /* Keep the red now-line and the side panel's countdown live, once a minute. */
  function startLiveTick() {
    let lastMin = -1;
    setInterval(function () {
      const m = Math.floor(Date.now() / 60000);
      if (m === lastMin) return;
      lastMin = m;
      updateLiveTitle();
      if (document.hidden || modal.open || peek.open || ui.page !== "calendar") return;
      renderCalendar();
    }, 15000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) updateLiveTitle();
      if (!document.hidden && ui.page === "calendar" && !modal.open) renderCalendar();
    });
  }

  function init() {
    S.load();
    applyTheme();
    ui.cursor = initialCursor();
    bind();
    bindSlotGhost();
    render();
    startLiveTick();
    if (!S.get().onboarded) {
      const dlg = document.getElementById("onboarding");
      if (dlg && !dlg.open) dlg.showModal();
    }
  }

  init();
})();
