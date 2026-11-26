// download the exact export each scheduled post uses (public API directUrl must carry the same -download-<ts>)
import fs from "node:fs";
const SM = "C:/Users/monkh/submagic-api";
const KEY = fs.readFileSync(`${SM}/.env`, "utf8").match(/^SUBMAGIC_API_KEY=(.*)$/m)[1].trim();
const q = JSON.parse(fs.readFileSync("C:/Users/monkh/gabriel-reels/queue-matched.json", "utf8"));
const dir = "C:/Users/monkh/gabriel-reels/raw";
fs.mkdirSync(dir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
for (const r of q) {
  const file = `${dir}/${r.date}_${r.proj.slice(0, 8)}.mp4`;
  if (fs.existsSync(file) && fs.statSync(file).size > 100000) { log.push(`${r.date} have`); continue; }
  let p;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`https://api.submagic.co/v1/projects/${r.proj}`, { headers: { "x-api-key": KEY } });
    if (res.status === 429) { console.log("429, waiting 60s"); await sleep(60000); continue; }
    p = await res.json();
    if (p.id === r.proj) break;
    await sleep(3000);
  }
  if (!p || p.id !== r.proj) { log.push(`${r.date} ${r.proj.slice(0, 8)} PROJECT FETCH FAILED`); continue; }
  const ts = (String(p.directUrl || "").match(/-download-(\d{13})/) || [])[1];
  if (ts !== r.ts) { log.push(`${r.date} ${r.proj.slice(0, 8)} EXPORT MISMATCH queue=${r.ts} now=${ts}`); continue; }
  const v = await fetch(p.directUrl);
  if (!v.ok) { log.push(`${r.date} ${r.proj.slice(0, 8)} DOWNLOAD ${v.status}`); continue; }
  const buf = Buffer.from(await v.arrayBuffer());
  fs.writeFileSync(file, buf);
  log.push(`${r.date} ${r.proj.slice(0, 8)} ok ${(buf.length / 1e6).toFixed(1)}MB`);
  console.log(log.at(-1));
  await sleep(1500);
}
fs.writeFileSync("C:/Users/monkh/gabriel-reels/fetch-log.txt", log.join("\n"));
console.log("DONE", log.filter((l) => /ok|have/.test(l)).length, "/", q.length);
