/**
 * playlist-planner API proxy (Cloudflare Worker)
 * ------------------------------------------------
 * Keeps your YouTube API key server-side. The static site calls this
 * worker instead of Google directly, so the key never reaches the browser.
 *
 * DEPLOY:
 * 1. Sign up free at https://dash.cloudflare.com (no card needed).
 * 2. Workers & Pages -> Create -> Create Worker. Name it e.g.
 *    "playlist-planner-api" and deploy the default.
 * 3. Click "Edit code", delete the default contents, paste this file in,
 *    then Deploy.
 * 4. Go to Settings -> Variables -> Add variable:
 *      name: YOUTUBE_API_KEY
 *      value: <your actual API key>
 *      -> click "Encrypt" so it's stored as a secret.
 * 5. (Optional but recommended once your site is live) Add another
 *    variable: ALLOWED_ORIGIN = https://yourname.github.io
 *    This locks the worker to only answer requests from your site.
 *    Leave it unset while testing locally -- it defaults to "*".
 * 6. Copy the worker's URL (shown at the top of its dashboard page, looks
 *    like https://playlist-planner-api.yoursubdomain.workers.dev) and
 *    paste it into WORKER_URL near the top of index.html's <script>.
 */

export default {
  async fetch(request, env) {
    const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!env.YOUTUBE_API_KEY) {
      return jsonError("Worker is missing the YOUTUBE_API_KEY variable.", 500, corsHeaders);
    }

    const url = new URL(request.url);

    try {
      let targetUrl;

      if (url.pathname === "/playlistItems") {
        const playlistId = url.searchParams.get("playlistId");
        const pageToken = url.searchParams.get("pageToken") || "";
        if (!playlistId) return jsonError("Missing playlistId", 400, corsHeaders);

        targetUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
        targetUrl.searchParams.set("part", "snippet,contentDetails");
        targetUrl.searchParams.set("maxResults", "50");
        targetUrl.searchParams.set("playlistId", playlistId);
        if (pageToken) targetUrl.searchParams.set("pageToken", pageToken);
        targetUrl.searchParams.set("key", env.YOUTUBE_API_KEY);

      } else if (url.pathname === "/videos") {
        const ids = url.searchParams.get("ids");
        if (!ids) return jsonError("Missing ids", 400, corsHeaders);

        targetUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        targetUrl.searchParams.set("part", "contentDetails");
        targetUrl.searchParams.set("id", ids);
        targetUrl.searchParams.set("key", env.YOUTUBE_API_KEY);

      } else {
        return jsonError("Not found", 404, corsHeaders);
      }

      const apiRes = await fetch(targetUrl);
      const data = await apiRes.text();

      return new Response(data, {
        status: apiRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (err) {
      return jsonError(err.message || "Worker error", 500, corsHeaders);
    }
  },
};

function jsonError(message, status, corsHeaders) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
