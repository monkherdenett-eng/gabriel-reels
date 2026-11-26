// ===== Gabriel — scheduled Reels to Instagram (gabriel.wavecounter) + Facebook (Gabriel Forex Trading Arena) =====
// n8n Code node, runs every 30 min. Config node: graphVersion, igUserId, pageId, accessToken (Gabriel PAGE token with
// pages_manage_posts + instagram_content_publish), manifestUrl (manifest.json in monkherdenett-eng/gabriel-reels), dryRun.
// Every entry whose date is today (Ulaanbaatar) and whose time has passed is posted. Safe to re-run: a platform that
// already has a post with this exact caption is skipped, so a failed or repeated run never double-posts, and a platform
// that failed is retried on the next run (until the day ends). Copied from «Devterfx - Reels + Carousels» minus the
// AI-voice label (these are real podcast voices, as they were on Submagic).
const cfg = $input.first().json;
const G = `https://graph.facebook.com/${cfg.graphVersion}`;
const token = cfg.accessToken, igUser = cfg.igUserId, pageId = cfg.pageId;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = (method, path, params) => this.helpers.httpRequest({ method, url: `${G}/${path}`, qs: { ...params, access_token: token }, json: true });
const dry = cfg.dryRun === true || cfg.dryRun === "true";

const manifest = await this.helpers.httpRequest({ method: "GET", url: `${cfg.manifestUrl}?t=${Date.now()}`, json: true });
const ub = new Date(Date.now() + 8 * 3600e3);
const today = ub.toISOString().slice(0, 10), now = ub.toISOString().slice(11, 16);
const force = cfg.forceDate || ""; // one-off: post this date's entry now (manual test run)
const due = (manifest.posts || []).filter((p) => (dry ? p.date === (cfg.dryDate || today) : force ? p.date === force : p.date === today && p.time <= now));
if (!due.length) return [{ json: { skipped: true, today, now, reason: "Энэ цагт нийтлэх пост алга" } }];

// what is already up (exact caption)
const igRecent = await http("GET", `${igUser}/media`, { fields: "id,caption", limit: 40 });
const igHas = new Map((igRecent.data || []).map((m) => [m.caption, m]));
const fbReels = await http("GET", `${pageId}/video_reels`, { fields: "id,description", limit: 30 });
const fbPosts = await http("GET", `${pageId}/posts`, { fields: "id,message", limit: 30 });
const fbHas = new Map([...(fbReels.data || []).map((v) => [v.description, v]), ...(fbPosts.data || []).map((p) => [p.message, p])]);

// the video must be really there (a cached error page must never reach Meta)
const ensureMedia = async (url, min) => {
  const head = async () => {
    const r = await this.helpers.httpRequest({ method: "HEAD", url, returnFullResponse: true, ignoreHttpStatusErrors: true });
    return { status: r.statusCode, bytes: Number(r.headers["content-length"] || 0) };
  };
  let h = await head();
  for (let i = 0; i < 3 && (h.status !== 200 || h.bytes < min); i++) { await sleep(15000); h = await head(); }
  if (h.status !== 200 || h.bytes < min) throw new Error(`Видео файл олдсонгүй эсвэл эвдэрсэн (status=${h.status}, ${h.bytes} байт): ${url}`);
};
const waitReady = async (id, tries, gap) => {
  for (let i = 0; i < tries; i++) {
    const s = await http("GET", id, { fields: "status_code,status" });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR") throw new Error("IG container ERROR: " + JSON.stringify(s));
    await sleep(gap);
  }
  throw new Error("IG container бэлэн болсонгүй: " + id);
};

const results = [];
for (const post of due) {
  const out = { id: post.id, date: post.date, time: post.time, ig: null, fb: null, igAttempts: [] };
  results.push(out);
  const igDone = igHas.get(post.caption), fbDone = fbHas.get(post.caption);
  if (igDone) out.ig = "already: " + igDone.id;
  if (fbDone) out.fb = "already: " + fbDone.id;
  if ((!post.ig || igDone) && (!post.fb || fbDone)) continue;
  try { await ensureMedia(post.videoCdn, post.bytes ? Math.min(post.bytes, 300000) : 300000); } catch (e) { out.error = e.message; continue; }

  if (post.ig && !igDone) {
    for (let attempt = 1; attempt <= 3 && !out.ig; attempt++) {
      try {
        const creation = (await http("POST", `${igUser}/media`, { media_type: "REELS", video_url: post.videoCdn, caption: post.caption, share_to_feed: true })).id;
        await waitReady(creation, 80, 3000);
        if (dry) { out.ig = "dry-run OK (container FINISHED, not published): " + creation; break; }
        out.ig = (await http("POST", `${igUser}/media_publish`, { creation_id: creation })).id;
      } catch (e) {
        out.igAttempts.push(attempt + ": " + (e.message || e));
        if (attempt < 3) await sleep(30000);
      }
    }
  }

  if (post.fb && !fbDone && !dry) {
    try {
      const start = await http("POST", `${pageId}/video_reels`, { upload_phase: "start" });
      await this.helpers.httpRequest({ method: "POST", url: `https://rupload.facebook.com/video-upload/${cfg.graphVersion}/${start.video_id}`, headers: { Authorization: `OAuth ${token}`, file_url: post.videoCdn }, json: true });
      out.fbFinish = await http("POST", `${pageId}/video_reels`, { video_id: start.video_id, upload_phase: "finish", video_state: "PUBLISHED", description: post.caption });
      out.fb = start.video_id;
    } catch (error) {
      try {
        out.fb = (await http("POST", `${pageId}/videos`, { file_url: post.videoCdn, description: post.caption })).id;
        out.fbFallback = "video_reels боломжгүй тул /videos-оор тавив: " + (error.message || error);
      } catch (e2) { out.fbError = (error.message || error) + " | " + (e2.message || e2); }
    }
  }
  if (dry) out.fb = out.fb || "dry-run: FB skipped";
}

// a failed platform marks the execution red (visible in n8n); the next half hour retries only what is missing
const failed = results.filter((o) => o.error || (!o.ig && due.find((p) => p.id === o.id).ig) || (!o.fb && due.find((p) => p.id === o.id).fb));
if (failed.length) throw new Error("Gabriel reel пост алдаа: " + JSON.stringify(results));
return results.map((json) => ({ json }));
