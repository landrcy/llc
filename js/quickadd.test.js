/* Node unit checks for the quick-add parser. Today is Tuesday, Nov 17, 2026. */
const assert = require("assert");
const { parse } = require("./quickadd.js");

const NOW = new Date(2026, 10, 17, 11, 20, 0); // Tue Nov 17, 2026

function check(input, expect) {
  const got = parse(input, NOW);
  try {
    Object.keys(expect).forEach(function (k) {
      const ev = expect[k], gv = got[k];
      if (ev instanceof RegExp) {
        assert.ok(ev.test(String(gv)), k + " " + ev + " vs " + JSON.stringify(gv));
      } else {
        assert.strictEqual(gv, ev, k + " expected " + JSON.stringify(ev) + " got " + JSON.stringify(gv));
      }
    });
    console.log("  PASS", JSON.stringify(input), "→", got.preview);
  } catch (err) {
    console.log("  FAIL", JSON.stringify(input));
    console.log("    got", got);
    throw err;
  }
}

console.log("quick-add parser (today = Tue Nov 17, 2026)");

check("chem quiz fri 2pm", {
  ok: true,
  title: /chem quiz/i,
  date: "2026-11-20",
  startTime: "14:00",
  endTime: "15:00",
  kind: "task",
  categoryId: "cat-classes",
  categoryName: "School",
  preview: "Fri, Nov 20 · 2:00–3:00 PM · School"
});

check("gym push wed 5pm", {
  ok: true,
  title: /push/i,
  date: "2026-11-18",
  startTime: "17:00",
  endTime: "18:00",
  kind: "gym",
  gymSession: "Push",
  categoryId: "cat-gym",
  categoryName: "Gym",
  preview: "Wed, Nov 18 · 5:00–6:00 PM · Gym"
});

check("essay due thu 11:59pm", {
  ok: true,
  title: /essay/i,
  date: "2026-11-19",
  startTime: "23:59",
  kind: "task",
  categoryId: "cat-classes",
  preview: "Thu, Nov 19 · 11:59 PM · School"
});

check("dentist nov 20 3-4pm", {
  ok: true,
  title: /dentist/i,
  date: "2026-11-20",
  startTime: "15:00",
  endTime: "16:00",
  kind: "event",
  categoryId: "cat-personal",
  categoryName: "Personal",
  preview: "Fri, Nov 20 · 3:00–4:00 PM · Personal"
});

check("movie tomorrow 8pm", {
  ok: true,
  title: /movie/i,
  date: "2026-11-18",
  startTime: "20:00",
  endTime: "21:00",
  kind: "event",
  categoryId: "cat-events",
  preview: "Wed, Nov 18 · 8:00–9:00 PM · Events"
});

check("study 2-3:30 today", {
  ok: true,
  title: /study/i,
  date: "2026-11-17",
  startTime: "14:00",
  endTime: "15:30",
  kind: "event",
  categoryId: "cat-events",
  preview: "Tue, Nov 17 · 2:00–3:30 PM · Events"
});

check("dentist 11/20 3-4pm", {
  ok: true,
  date: "2026-11-20",
  startTime: "15:00",
  endTime: "16:00",
  categoryId: "cat-personal"
});

check("call monday 9am", {
  ok: true,
  title: /call/i,
  date: "2026-11-23",
  startTime: "09:00",
  endTime: "10:00",
  categoryId: "cat-personal"
});

check("gym legs fri 18:00", {
  ok: true,
  gymSession: "Legs",
  date: "2026-11-20",
  startTime: "18:00",
  endTime: "19:00",
  kind: "gym"
});

check("hw friday", {
  ok: true,
  kind: "task",
  date: "2026-11-20",
  allDay: true,
  categoryId: "cat-classes"
});

check("meeting noon", {
  ok: true,
  title: /meeting/i,
  startTime: "12:00",
  endTime: "13:00",
  date: "2026-11-17"
});

const empty = parse("", NOW);
assert.strictEqual(empty.ok, false);
console.log("  PASS  empty input is not ok");

const tue = parse("office hours tuesday 4pm", NOW);
assert.strictEqual(tue.date, "2026-11-17");
console.log("  PASS  “tuesday” on a Tuesday means today");

console.log("all parser checks passed");
