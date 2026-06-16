// Cloudflare Pages Function — GET /api/prescription
// Returns every JSON code block on the Notion page, keyed by session: { pull: {...}, push: {...} }
export async function onRequest(context) {
  const { env, request } = context;
  const reqUrl = new URL(request.url);
  const cache = caches.default;
  const cacheKey = new Request(reqUrl.origin + "/api/prescription");
  if (!reqUrl.searchParams.has("nocache")) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const r = await fetch(`https://api.notion.com/v1/blocks/${env.NOTION_PAGE_ID}/children?page_size=100`, {
    headers: { "Authorization": `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28" },
  });
  if (!r.ok) return new Response(JSON.stringify({ error: "notion_fetch_failed", status: r.status }), {
    status: 502, headers: { "content-type": "application/json" } });

  const blocks = (await r.json()).results || [];
  const out = {};
  for (const b of blocks) {
    if (b.type !== "code") continue;
    if (b.code?.language && b.code.language !== "json") continue;
    const raw = (b.code?.rich_text || []).map(t => t.plain_text).join("");
    try { const p = JSON.parse(raw); if (p?.session) out[String(p.session).toLowerCase()] = p; } catch {}
  }

  const res = new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
