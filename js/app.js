/* llc — UI */
(function () {
  const S = window.LLCStore;
  const Ics = window.LLCIcs;

  const CAT_PRI = { "cat-classes": 0, "cat-gym": 1, "cat-events": 2, "cat-personal": 3 };

  const ui = {
    page: "home",
    mode: "month",
    cursor: new Date(),
    hiddenCats: new Set(),
    taskFilter: "open",
    sidebarOpen: false,
    gymWeek: null
  };

  const hubMotion = { running: false, raf: 0, nodes: [], onMove: null, onResize: null, mouse: { x: 0, y: 0, inside: false } };

  let notified = new Set();
  try { notified = new Set(JSON.parse(sessionStorage.getItem("llc-notified") || "[]")); } catch (e) { notified = new Set(); }

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

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
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

  function shiftPeriod(dir) {
    const d = new Date(ui.cursor);
    if (ui.mode === "month") d.setMonth(d.getMonth() + dir);
    else if (ui.mode === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    ui.cursor = d;
    render();
  }


  function render() {
    applyTheme();
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
    document.getElementById("period-label").textContent = periodLabel();
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
    closeSidebar();
  }

  function renderCatFilters() {
    const box = document.getElementById("category-filters");
    box.innerHTML = S.get().categories.map(function (c) {
      const off = ui.hiddenCats.has(c.id) ? " is-off" : "";
      return '<button type="button" class="cat-filter' + off + '" data-act="toggle-cat" data-id="' + esc(c.id) + '">' +
        '<span class="swatch" style="--c:' + esc(c.color) + '"></span>' + esc(c.name) + "</button>";
    }).join("");
  }

  function renderCalendar() {
    const board = document.getElementById("calendar-board");
    if (ui.mode === "month") board.innerHTML = monthHTML();
    else if (ui.mode === "week") board.innerHTML = timeCalHTML("week");
    else board.innerHTML = timeCalHTML("day");
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
        const items = S.getOccurrencesInRange(d, d, { hiddenCats: ui.hiddenCats });
        let cls = "day-cell";
        if (outside) cls += " is-outside";
        if (ds === todayStr) cls += " is-today";
        html += '<div class="' + cls + '" data-act="open-day" data-date="' + ds + '">';
        html += '<div class="day-num">' + d.getDate() + "</div>";
        const max = 3;
        items.slice(0, max).forEach(function (it) {
          const taskClass = it.source === "task" ? " is-task" + (it.done ? " is-done" : "") : " is-short";
          html += '<button type="button" class="evt-pill' + taskClass + '" data-act="open-occ" data-id="' + esc(it.id) + '" style="--c:' + esc(catColor(it.categoryId)) + '">' +
            (it.source === "task" ? "" : '<span class="dot"></span>') + esc(shortTitle(it)) + "</button>";
        });
        if (items.length > max) {
          html += '<button type="button" class="more-btn" data-act="open-day" data-date="' + ds + '">+' + (items.length - max) + " more</button>";
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
          html += '<button type="button" class="evt-pill' + taskClass + '" data-act="open-occ" data-id="' + esc(it.id) + '" style="--c:' + esc(catColor(it.categoryId)) + '">' + esc(shortTitle(it)) + "</button>";
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
      const tooClose = (m !== range.start && Math.abs(m - range.start) < 50) || (m !== range.end && Math.abs(m - range.end) < 50);
      if (!tooClose) html += '<div class="hour-label' + edge + '" style="top:' + top + '%">' + esc(gutterLabel(m)) + "</div>";
    });
    html += "</div>";

    dayDates.forEach(function (d) {
      const ds = S.toDateStr(d);
      const items = packColumns(
        S.getOccurrencesInRange(d, d, { hiddenCats: ui.hiddenCats }).filter(function (it) { return !it.allDay && it.startTime; })
      );
      html += '<div class="day-col" data-act="add-at" data-date="' + ds + '">';
      if (ds === todayStr) {
        const nowMin = now.getHours() * 60 + now.getMinutes();
        if (nowMin >= range.start && nowMin <= range.end) {
          html += '<div class="now-line" style="top:' + yPct(nowMin) + '%"></div>';
        }
      }
      items.forEach(function (it) {
        const startMin = S.minutesSinceMidnight(it.startTime);
        const endMin = it.endTime ? S.minutesSinceMidnight(it.endTime) : startMin + 60;
        const dur = Math.max(endMin - startMin, 15);
        const top = yPct(startMin);
        const height = (dur / span) * 100;
        const width = 100 / it._cols;
        const left = width * it._col;
        const detailed = kind === "day";
        const descBits = [];
        if (detailed) {
          if (it.location) descBits.push(it.location);
          if (it.notes) descBits.push(it.notes);
          if (it.source === "task") descBits.push("Homework" + (it.done ? " (done)" : ""));
        }
        const isShort = !detailed && dur < 40;
        const sty = "--c:" + catColor(it.categoryId) + ";top:" + top + "%;height:calc(" + height + "% - 2px);left:calc(" + left + "% + 2px);width:calc(" + width + "% - 4px);right:auto;";
        html += '<button type="button" class="evt-block' + (detailed ? " is-detailed" : "") + (isShort ? " is-short" : "") + '" data-act="open-occ" data-id="' + esc(it.id) + '" style="' + sty + '">';
        if (isShort) {
          html += '<span class="ttl">' + esc(shortTitle(it)) + ", " + esc(S.formatGCalTime(it.startTime)) + "</span>";
        } else {
          html += '<span class="ttl">' + (detailed ? esc(it.title) : esc(shortTitle(it))) + "</span>";
          html += '<span class="t">' + esc(S.formatGCalRange(it.startTime, it.endTime)) + "</span>";
        }
        if (descBits.length) html += '<span class="desc">' + esc(descBits.join(" · ")) + "</span>";
        html += "</button>";
      });
      html += "</div>";
    });

    html += "</div></div></div>";
    return html;
  }

  function occRow(it, extra, whenText) {
    return '<button type="button" class="agenda-item" data-act="open-occ" data-id="' + esc(it.id) + '">' +
      '<span class="bar" style="--c:' + esc(catColor(it.categoryId)) + '"></span>' +
      '<span class="meta"><span class="title">' + esc(it.title) + (extra || "") + "</span>" +
      '<span class="sub">' + esc(whenText || timeLabel(it)) + "</span></span></button>";
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
    if (it.date === todayStr) return timeLabel(it);
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
      return it.date > todayStr && it.date <= soonEnd && it !== next;
    }).sort(compareOcc);

    let html = '<h2 class="panel-title">' + esc(S.formatDateNice(now)) + "</h2>";
    html += '<div class="panel-section happening"><h3>Happening now / Next up</h3>';
    if (!happening.length && !next) html += '<p class="empty-note">Nothing coming up.</p>';
    happening.forEach(function (it) { html += occRow(it, '<span class="badge-now">Now</span>'); });
    if (next) html += occRow(next, "", nextWhenLabel(next, todayStr));
    html += "</div>";

    html += '<div class="panel-section"><h3>Today</h3>';
    if (!todayItems.length) html += '<p class="empty-note">No items today.</p>';
    todayItems.forEach(function (it) { html += occRow(it, it.done ? " · done" : ""); });
    html += "</div>";

    html += '<div class="panel-section"><h3>This week / upcoming soon</h3>';
    if (!weekItems.length) html += '<p class="empty-note">Nothing scheduled this week.</p>';
    else {
      let last = "";
      weekItems.forEach(function (it) {
        if (it.date !== last) {
          html += '<div class="agenda-date">' + esc(S.formatDateNice(it.date)) + "</div>";
          last = it.date;
        }
        html += occRow(it);
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
      html += '<div class="card"><p class="empty-note">No classes yet. Add a semester schedule and it will fill the calendar.</p></div>';
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

  function renderGymPage() {
    const weekStart = S.startOfGymWeek(ui.gymWeek || new Date());
    const key = S.toDateStr(weekStart);
    const plan = S.get().gymPlan || {};
    const week = (plan.weeks && plan.weeks[key]) || {};
    const workouts = S.get().workouts.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    const required = ["Push", "Pull", "Legs"].filter(function (n) { return !!gymSlot(week, n); }).length;
    const hasBonus = !!gymSlot(week, "Bonus");
    const progress = required + "/3 this week" + (hasBonus ? " (+bonus)" : "");
    const thisWeek = S.toDateStr(S.startOfGymWeek(new Date())) === key;

    let html = '<div class="page-head"><div><h2>Gym</h2></div></div>';
    html += '<div class="gym-week-bar">';
    html += '<button class="ghost-btn" type="button" data-act="gym-week" data-dir="-1">Previous</button>';
    html += "<div><h3>Week of " + esc(S.MONTHS[weekStart.getMonth()] + " " + weekStart.getDate()) + "</h3>";
    html += '<div class="gym-progress">' + esc(progress) + "</div></div>";
    html += '<div class="row-actions">';
    if (!thisWeek) html += '<button class="ghost-btn" type="button" data-act="gym-week" data-dir="0">This week</button>';
    html += '<button class="ghost-btn" type="button" data-act="gym-week" data-dir="1">Next</button></div></div>';

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
          html += '<button class="occ-row" type="button" data-act="ex-history" data-name="' + esc(n) + '"><span class="bar" style="--c:#E25A3C"></span><span class="meta"><span class="title">' + esc(n) + '</span><span class="sub">View history</span></span></button>';
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
    html += '<div class="card-list">';
    shown.forEach(function (t) {
      const overdue = !t.done && t.dueDate && t.dueDate < todayStr;
      const cls = S.get().classes.find(function (c) { return c.id === t.classId; });
      html += '<div class="task-row' + (t.done ? " is-done" : "") + (overdue ? " is-overdue" : "") + '">' +
        '<input type="checkbox" data-act="toggle-task" data-id="' + esc(t.id) + '"' + (t.done ? " checked" : "") + " />" +
        '<button class="task-main" type="button" data-act="edit-task" data-id="' + esc(t.id) + '">' +
        '<div class="task-title">' + esc(t.title) + "</div>" +
        '<div class="muted due">' + esc((cls ? cls.shortName || cls.name : "General") + (t.dueDate ? " · due " + S.formatDateNice(t.dueDate) : "") + (t.dueTime ? " " + S.formatTime(t.dueTime) : "")) + "</div>" +
        "</button></div>";
    });
    html += "</div>";
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
        (c.builtin ? '<span class="muted">Built-in</span>' : '<button class="danger-btn" type="button" data-act="delete-cat" data-id="' + esc(c.id) + '">Delete</button>') +
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
      location: "Broward College", notes: "", reminderMinutes: S.get().settings.defaultReminderMinutes,
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
        field("Reminder (minutes before)", '<input type="number" id="f-remind" min="0" max="180" value="' + esc(cls.reminderMinutes == null ? "" : cls.reminderMinutes) + '" />') +
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
      reminderMinutes: numOrNull(val("f-remind")),
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
      allDay: false, location: "", notes: "", reminderMinutes: S.get().settings.defaultReminderMinutes,
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
        field("Reminder (minutes before)", '<input type="number" id="f-remind" min="0" max="180" value="' + esc(ev.reminderMinutes == null ? "" : ev.reminderMinutes) + '" />') +
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
      reminderMinutes: numOrNull(val("f-remind")),
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
    const t = existing || { title: "", classId: "", dueDate: S.toDateStr(ui.cursor), dueTime: "", notes: "", done: false, categoryId: "cat-classes", reminderMinutes: S.get().settings.defaultReminderMinutes };
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

  function persistNotified() {
    try { sessionStorage.setItem("llc-notified", JSON.stringify(Array.from(notified).slice(-200))); } catch (e) {}
  }

  function checkReminders() {
    const st = S.get();
    if (!st.settings.remindersEnabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    const items = S.getOccurrencesInRange(S.addDays(now, -1), S.addDays(now, 2));
    items.forEach(function (it) {
      if (it.allDay || !it.startTime) return;
      const mins = it.reminderMinutes == null ? st.settings.defaultReminderMinutes : it.reminderMinutes;
      if (mins == null) return;
      const start = S.combine(it.date, it.startTime);
      const trigger = new Date(start.getTime() - Number(mins) * 60000);
      if (now >= trigger && now < start && !notified.has(it.id)) {
        notified.add(it.id);
        persistNotified();
        try { new Notification(it.title, { body: timeLabel(it) + " · in " + mins + " min", silent: true }); } catch (e) {}
      }
    });
  }

  function enableReminders() {
    if (!("Notification" in window)) return toast("Notifications are not available in this browser.");
    const done = function (perm) {
      S.update(function (d) { d.settings.remindersEnabled = perm === "granted"; });
      if (perm === "granted") toast("Reminders on. They only fire while this tab is open.");
      else toast("Permission was not granted.");
      render();
    };
    if (Notification.permission === "granted") return done("granted");
    Notification.requestPermission().then(done);
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
      openOccurrence(t.getAttribute("data-id"));
      return;
    }
    if (act === "open-day") {
      e.preventDefault();
      ui.cursor = S.parseDateStr(t.getAttribute("data-date"));
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
if (act === "toggle-reminders") {
      if (S.get().settings.remindersEnabled) {
        S.update(function (d) { d.settings.remindersEnabled = false; });
        render();
      } else enableReminders();
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
    if (act === "export-json") {
      download("llc-backup.json", S.exportJSON(), "application/json");
      toast("Backup downloaded.");
      return;
    }
    if (act === "import-json") { document.getElementById("file-json").click(); return; }
    if (act === "export-ics") {
      download("llc-calendar.ics", Ics.exportICS(S.get()), "text/calendar");
      toast("Calendar exported.");
      return;
    }
    if (act === "import-ics") { document.getElementById("file-ics").click(); return; }
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
      ui.mode = b.getAttribute("data-mode");
      render();
    });
    document.getElementById("prev-btn").addEventListener("click", function () { shiftPeriod(-1); });
    document.getElementById("next-btn").addEventListener("click", function () { shiftPeriod(1); });
    document.getElementById("today-btn").addEventListener("click", function () { ui.cursor = new Date(); render(); });
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

    document.getElementById("file-json").addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try { S.importJSON(String(reader.result)); ui.cursor = initialCursor(); render(); toast("Backup imported."); }
        catch (err) { toast("Could not read that JSON file."); }
      };
      reader.readAsText(file);
    });
    document.getElementById("file-ics").addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const evs = Ics.parseICS(String(reader.result));
          if (!evs.length) return toast("No events found in that file.");
          S.update(function (d) { d.events = d.events.concat(evs); });
          render();
          toast("Imported " + evs.length + " event" + (evs.length === 1 ? "" : "s") + ".");
        } catch (err) { toast("Could not read that calendar file."); }
      };
      reader.readAsText(file);
    });

    document.addEventListener("change", function (e) {
      if (e.target && e.target.id === "reminder-mins") {
        const n = Number(e.target.value);
        if (!isNaN(n)) S.update(function (d) { d.settings.defaultReminderMinutes = n; });
      }
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
      if (e.target && e.target.id === "f-split") applySplitPreset(e.target.value);
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

    document.addEventListener("keydown", function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (modal.open) return;
      if (e.key === "t") { ui.cursor = new Date(); ui.page = "calendar"; render(); }
      if (e.key === "ArrowLeft" || e.key === "p") shiftPeriod(-1);
      if (e.key === "ArrowRight" || e.key === "n") shiftPeriod(1);
      if (e.key === "1") { ui.page = "calendar"; ui.mode = "month"; render(); }
      if (e.key === "2") { ui.page = "calendar"; ui.mode = "week"; render(); }
      if (e.key === "3") { ui.page = "calendar"; ui.mode = "day"; render(); }
    });
  }

  function init() {
    S.load();
    applyTheme();
    ui.cursor = initialCursor();
    bind();
    render();
    if (!S.get().onboarded) {
      const dlg = document.getElementById("onboarding");
      if (dlg && !dlg.open) dlg.showModal();
    }
  }

  init();
})();
