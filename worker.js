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
