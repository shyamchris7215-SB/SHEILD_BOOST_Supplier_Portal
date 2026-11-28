

/*
 SHEILD BOOST — Secure Staging API Proxy
 GitHub branch: staging ONLY
 File: functions/api/submissions.js

 Requires Preview environment bindings:
 STAGING_API         Service binding
 STAGING_PROXY_TOKEN Encrypted secret

 Never place secrets in frontend HTML.
*/

const STAGING_ORIGIN =
  "https://staging.sheild-boost-supplier-portal.pages.dev";

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

function error(message, status) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);

  // Only the designated staging hostname is permitted.
  if (url.origin !== STAGING_ORIGIN) {
    return error("Not found", 404);
  }

  // Reject requests from a different browser origin.
  if (
    request.headers.get("Origin") !== STAGING_ORIGIN
  ) {
    return error("Origin not allowed", 403);
  }

  const contentType =
    request.headers.get("Content-Type") || "";

  if (
    !/^multipart\/form-data\s*;/i.test(contentType)
  ) {
    return error("Expected multipart form data", 415);
  }

  const declaredSize = Number(
    request.headers.get("Content-Length") || 0
  );

  if (
    !Number.isFinite(declaredSize) ||
    declaredSize > MAX_REQUEST_BYTES
  ) {
    return error("Upload request too large", 413);
  }

  // Require both staging server-side bindings.
  if (
    !env.STAGING_API ||
    typeof env.STAGING_API.fetch !== "function" ||
    typeof env.STAGING_PROXY_TOKEN !== "string" ||
    env.STAGING_PROXY_TOKEN.length < 32
  ) {
    return error(
      "Staging proxy is not configured",
      503
    );
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Origin": STAGING_ORIGIN,
    "X-Staging-Proxy-Token":
      env.STAGING_PROXY_TOKEN
  });

  try {
    const upstreamRequest = new Request(
      "https://staging-api.internal/api/submissions",
      {
        method: "POST",
        headers,
        body: request.body,
        duplex: "half"
      }
    );

    const response =
      await env.STAGING_API.fetch(upstreamRequest);

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ||
          "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });

  } catch {
    return error(
      "Staging API is unavailable",
      502
    );
  }
}

export function onRequestGet() {
  return error("Method not allowed", 405);
}

export function onRequestOptions() {
  return error("Method not allowed", 405);
}
