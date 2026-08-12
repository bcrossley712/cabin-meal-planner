/**
 * Cloudflare Worker — the entire backend.
 *
 * Storage: one JSON blob in KV under the key "trips-data", shaped as
 *   { updatedAt: "<ISO timestamp>" | null, trips: [...] }
 *
 * Endpoints:
 *   GET  /api/trips   — public, no passcode needed. Returns the current data.
 *   PUT  /api/trips    — requires header "X-Passcode" matching the
 *                        FAMILY_PASSCODE secret. Body: { trips, expectedUpdatedAt }.
 *                        Rejects with 409 if expectedUpdatedAt doesn't match
 *                        what's currently stored (someone else saved first).
 *
 * Required setup (see README.md in this folder):
 *   - KV namespace bound as CABIN_KV
 *   - Secret: FAMILY_PASSCODE
 *   - Var (optional): ALLOWED_ORIGIN — restrict CORS to your GitHub Pages
 *     origin once deployed. Defaults to "*" if unset.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Passcode",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === "/api/trips" && request.method === "GET") {
      const raw = await env.CABIN_KV.get("trips-data");
      const data = raw ? JSON.parse(raw) : { updatedAt: null, trips: [] };
      return jsonResponse(data, cors);
    }

    if (url.pathname === "/api/trips" && request.method === "PUT") {
      const passcode = request.headers.get("X-Passcode") || "";
      if (passcode !== env.FAMILY_PASSCODE) {
        return jsonResponse({ error: "Incorrect passcode" }, cors, 401);
      }

      let body;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse({ error: "Invalid JSON body" }, cors, 400);
      }
      if (!Array.isArray(body.trips)) {
        return jsonResponse({ error: "Missing trips array" }, cors, 400);
      }

      const raw = await env.CABIN_KV.get("trips-data");
      const current = raw ? JSON.parse(raw) : { updatedAt: null, trips: [] };

      if (body.expectedUpdatedAt !== current.updatedAt) {
        return jsonResponse({ error: "conflict", current }, cors, 409);
      }

      const next = { updatedAt: new Date().toISOString(), trips: body.trips };
      await env.CABIN_KV.put("trips-data", JSON.stringify(next));
      return jsonResponse(next, cors);
    }

    return jsonResponse({ error: "Not found" }, cors, 404);
  },
};

function jsonResponse(obj, cors, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
