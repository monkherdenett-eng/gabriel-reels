// Create (or update) the n8n workflow «Gabriel — Scheduled Reels (IG + FB)».
//   N8N_KEY=… GB_TOKEN_FILE=<file with Gabriel page token> node n8n/deploy.mjs [--activate] [--dry]
// The page token is read from a file (never printed, never committed). Without --activate the workflow stays inactive.
import fs from "node:fs";
const KEY = process.env.N8N_KEY;
const TOKEN = fs.readFileSync(process.env.GB_TOKEN_FILE, "utf8").trim();
const API = "https://kaizeco.online/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const NAME = "Gabriel — Scheduled Reels (IG + FB)";
const code = fs.readFileSync(new URL("./publish-code.js", import.meta.url), "utf8");
const dry = process.argv.includes("--dry");
const nodes = [
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 */30 * * * *" }] } }, name: "Every 30 min", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [0, 0] },
  { parameters: {}, name: "Test (manual)", type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [0, 200] },
  {
    parameters: {
      assignments: {
        assignments: [
          { id: "a1", name: "graphVersion", value: "v25.0", type: "string" },
          { id: "a2", name: "igUserId", value: "17841468492914125", type: "string" },
          { id: "a3", name: "pageId", value: "385349924661529", type: "string" },
          { id: "a4", name: "accessToken", value: TOKEN, type: "string" },
          { id: "a5", name: "manifestUrl", value: "https://raw.githubusercontent.com/monkherdenett-eng/gabriel-reels/main/manifest.json", type: "string" },
          { id: "a6", name: "dryRun", value: dry, type: "boolean" },
          { id: "a7", name: "dryDate", value: "", type: "string" },
        ],
      },
      options: {},
    },
    name: "Config", type: "n8n-nodes-base.set", typeVersion: 3.4, position: [240, 100],
  },
  { parameters: { jsCode: code }, name: "Publish IG + FB", type: "n8n-nodes-base.code", typeVersion: 2, position: [480, 100] },
];
const connections = { "Every 30 min": { main: [[{ node: "Config", type: "main", index: 0 }]] }, "Test (manual)": { main: [[{ node: "Config", type: "main", index: 0 }]] }, Config: { main: [[{ node: "Publish IG + FB", type: "main", index: 0 }]] } };
const body = { name: NAME, nodes, connections, settings: { executionOrder: "v1", timezone: "Asia/Ulaanbaatar", saveDataErrorExecution: "all", saveDataSuccessExecution: "all" } };

const list = await (await fetch(`${API}/workflows?limit=200`, { headers: H })).json();
if (!list.data) throw new Error("n8n API: " + JSON.stringify(list).slice(0, 200));
const existing = list.data.find((w) => w.name === NAME);
let id;
if (existing) {
  const r = await fetch(`${API}/workflows/${existing.id}`, { method: "PUT", headers: H, body: JSON.stringify(body) });
  console.log("update", r.status); id = existing.id;
} else {
  const r = await fetch(`${API}/workflows`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const j = await r.json(); console.log("create", r.status, j.id || JSON.stringify(j).slice(0, 200)); id = j.id;
}
if (process.argv.includes("--activate") && id) {
  const r = await fetch(`${API}/workflows/${id}/activate`, { method: "POST", headers: H });
  console.log("activate", r.status);
}
console.log("workflow id", id);
