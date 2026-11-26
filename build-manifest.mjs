// manifest.json from queue-matched.json + committed videos (raw URL pinned to the commit that added each file)
import fs from "node:fs";
import { execSync } from "node:child_process";
const R = "C:/Users/monkh/gabriel-reels";
const q = JSON.parse(fs.readFileSync(`${R}/queue-matched.json`, "utf8"));
const posts = [], missing = [];
for (const r of q) {
  const name = `${r.date}_${r.proj.slice(0, 8)}.mp4`, rel = `videos/${name}`;
  const sha = execSync(`git -C ${R} log -1 --format=%H -- ${rel}`).toString().trim();
  if (!sha) { missing.push(name); continue; }
  const pushed = execSync(`git -C ${R} branch -r --contains ${sha}`).toString().includes("origin/main");
  if (!pushed) { missing.push(name + " (not pushed)"); continue; }
  posts.push({
    id: `gb-${r.date}-${r.proj.slice(0, 8)}`, type: "reel", date: r.date, time: "13:00",
    videoCdn: `https://raw.githubusercontent.com/monkherdenett-eng/gabriel-reels/${sha}/${rel}`,
    bytes: fs.statSync(`${R}/${rel}`).size, caption: r.caption, ig: true, fb: true, source: `submagic:${r.proj}`,
  });
}
fs.writeFileSync(`${R}/manifest.json`, JSON.stringify({ account: "Gabriel Forex Trading Arena (FB 385349924661529) + gabriel.wavecounter (IG 17841468492914125)", timezone: "Asia/Ulaanbaatar", generated: new Date().toISOString(), posts }, null, 1) + "\n");
console.log(`manifest: ${posts.length} posts${missing.length ? `, missing ${missing.length}: ${missing.slice(0, 5).join(", ")}…` : ""}`);
