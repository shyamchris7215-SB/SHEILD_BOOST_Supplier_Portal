
const ORIGIN =
  "https://staging.sheild-boost-supplier-portal.pages.dev";

export async function onRequestGet({ request, env }) {
  const reply = (result, status = 200) =>
    Response.json({ result }, {
      status,
      headers: { "Cache-Control": "no-store" }
    });

  if (new URL(request.url).origin !== ORIGIN) {
    return reply("NOT_FOUND", 404);
  }

  if (!env.STAGING_API ||
      typeof env.STAGING_API.fetch !== "function") {
    return reply("PAGES_BINDING_MISSING", 503);
  }

  if (typeof env.STAGING_PROXY_TOKEN !== "string" ||
      env.STAGING_PROXY_TOKEN.length < 32) {
    return reply("PAGES_SECRET_MISSING", 503);
  }

  const form = new FormData();
  form.append("payload", "{}");

  try {
    const response = await env.STAGING_API.fetch(
      new Request(
        "https://staging-api.internal/api/submissions",
        {
          method: "POST",
          headers: {
            "Origin": ORIGIN,
            "X-Staging-Proxy-Token":
              env.STAGING_PROXY_TOKEN
          },
          body: form
        }
      )
    );

    let data = {};
    try {
      data = await response.json();
    } catch {}

    if (response.status === 400 &&
        data.error === "Invalid registration type") {
      return reply("PROXY_CONNECTION_PASSED");
    }

    if (data.error === "Staging proxy is not configured") {
      return reply("WORKER_SECRET_MISSING", 503);
    }

    if (response.status === 404) {
      return reply("TOKEN_MISMATCH_OR_ROUTE_ERROR", 503);
    }

    if (response.status === 403) {
      return reply("WORKER_ACCESS_REJECTED", 503);
    }

    return reply("UPSTREAM_HTTP_" + response.status, 503);

  } catch {
    return reply("WORKER_CONNECTION_FAILED", 502);
  }
}

