// match each scheduled Submagic post (queue-index.txt: proj date sha12 len exportTs status) to a local caption file entry
import fs from "node:fs";
import crypto from "node:crypto";
const SM = "C:/Users/monkh/submagic-api";
const files = ["captions-p1.md", "captions-p2.md", "captions-p1-igretry.md", "captions-igretry2.md", "new/captions-p3.md", "new/captions-p4.md", "new/captions-p5.md"];
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);
const cands = {}; // f8 -> [{file, body, sha}]
for (const f of files) {
  const raw = fs.readFileSync(`${SM}/${f}`, "utf8").replace(/\r\n/g, "\n");
  for (const part of raw.split(/^## /m)) {
    if (!/^\s*\d+\s/.test(part)) continue;
    const lines = part.split("\n");
    const f8 = (lines[0].match(/\[([0-9a-f]{8})\]/) || [])[1];
    if (!f8) continue;
    const body = lines.slice(1).join("\n").trim().replace(/\s*-{3,}\s*$/s, "").trim();
    (cands[f8] ||= []).push({ file: f, head: lines[0], body, sha: sha(body) });
  }
}
const q = fs.readFileSync("C:/Users/monkh/gabriel-reels/queue-index.txt", "utf8").trim().split("\n").map((l) => { const [proj, date, h, len, ts, st] = l.split(" "); return { proj, date, h, len: +len, ts, st }; });
let ok = 0; const miss = [];
const out = [];
for (const r of q) {
  const c = (cands[r.proj.slice(0, 8)] || []).find((x) => x.sha === r.h);
  if (c) { ok++; out.push({ ...r, caption: c.body, src: c.file }); }
  else { miss.push(r); out.push({ ...r, caption: null }); console.log("MISS", r.date, r.proj.slice(0, 8), "len", r.len, "local:", (cands[r.proj.slice(0, 8)] || []).map((x) => `${x.file} ${x.sha} ${x.body.length}`).join(" ; ") || "none"); }
}
fs.writeFileSync("C:/Users/monkh/gabriel-reels/queue-matched.json", JSON.stringify(out, null, 1));
console.log(`matched ${ok}/${q.length}`);
