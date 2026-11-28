// Add the lesson reels (Gabriel's «Offline lesson reels» sheet, videos in monkherdenett-eng/gabriel-lessons) to
// manifest.json: one every second day at 20:00 UB starting 2026-11-29 (the podcast reels keep 13:00 on the other
// days), in sheet order. Caption = «Description (Instagram)», firstComment = «Pinned comment». Only videos already
// pushed to gabriel-lessons/main are added; their URL is pinned to that commit. Re-running replaces the gl- entries.
//   node add-lessons.mjs [--dry]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const LESSONS = "C:/Users/monkh/gabriel-lessons";
const START = "2026-11-29", STEP_DAYS = 2, TIME = "20:00";
const SKIP = new Set(["20260408_185434_01_fake_out_manipulation_final.mp4", "20260408_185434_02_fibonacci_yaj_tatah_final.mp4", "20260408_185434_04_retracement_duussaniig_batal_final.mp4"]);
const git = (...a) => execFileSync("git", ["-C", LESSONS, ...a], { encoding: "utf8" }).trim();
const sha = git("rev-parse", "origin/main");
const pushed = new Set(git("ls-tree", "-r", "--name-only", "origin/main", "videos").split("\n").filter(Boolean));
const rows = JSON.parse(fs.readFileSync(`${LESSONS}/sheet-rows.json`, "utf8")).filter((r) => !SKIP.has(r.file));
const stem = (f) => f.replace(/_final\.mp4$/, "");
const day = (i) => new Date(Date.parse(START + "T00:00:00Z") + i * STEP_DAYS * 864e5).toISOString().slice(0, 10);
const posts = [];
let missing = 0;
rows.forEach((r, i) => {
  const path = `videos/${stem(r.file)}.mp4`;
  if (!pushed.has(path)) { missing++; return; }
  const caption = r.desc.trim(), firstComment = r.pin.trim();
  if (caption.length > 2200 || (caption.match(/#/g) || []).length > 30) throw new Error(`${r.file}: caption over IG limits`);
  posts.push({
    id: `gl-${day(i)}-${r.rec.slice(9)}-${r.n}`,
    type: "reel",
    date: day(i),
    time: TIME,
    videoCdn: `https://raw.githubusercontent.com/monkherdenett-eng/gabriel-lessons/${sha}/${path}`,
    bytes: fs.statSync(`${LESSONS}/${path}`).size,
    caption,
    firstComment,
    ig: true,
    fb: true,
    source: `lesson:${r.file}`,
  });
});
const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const before = m.posts.length;
m.posts = [...m.posts.filter((p) => !String(p.id).startsWith("gl-")), ...posts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
console.log(`lessons: ${posts.length} added (${missing} not pushed yet), ${posts[0]?.date} → ${posts.at(-1)?.date}; manifest ${before} → ${m.posts.length} posts; sha ${sha.slice(0, 7)}`);
const clash = m.posts.filter((p, i, a) => a.findIndex((q) => q.date === p.date && q.time === p.time) !== i);
if (clash.length) throw new Error("two posts at the same date+time: " + clash.map((p) => p.id).join(","));
if (!process.argv.includes("--dry")) fs.writeFileSync("manifest.json", JSON.stringify(m, null, 1) + "\n");
