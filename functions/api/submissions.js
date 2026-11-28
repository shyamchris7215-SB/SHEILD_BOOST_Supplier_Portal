
/*
 SHEILD BOOST — Secure Production API Proxy

 GitHub branch: main
 File: functions/api/submissions.js

 Cloudflare Pages Production bindings:
 PRODUCTION_API         Service binding
 PRODUCTION_PROXY_TOKEN Encrypted secret

 Target Worker:
 sheildboost-supplier-api

 Never place secrets in frontend HTML or GitHub.
*/

const PRODUCTION_ORIGIN =
  "https://sheild-boost-supplier-portal.pages.dev";

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

  // Only the designated production hostname is permitted.
  if (url.origin !== PRODUCTION_ORIGIN) {
    return error("Not found", 404);
  }

  // Reject requests from a different browser origin.
  if (
    request.headers.get("Origin") !== PRODUCTION_ORIGIN
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

  // Require both production server-side bindings.
  if (
    !env.PRODUCTION_API ||
    typeof env.PRODUCTION_API.fetch !== "function" ||
    typeof env.PRODUCTION_PROXY_TOKEN !== "string" ||
    env.PRODUCTION_PROXY_TOKEN.length < 32
  ) {
    return error(
      "Production proxy is not configured",
      503
    );
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Origin": PRODUCTION_ORIGIN,
    "X-Production-Proxy-Token":
      env.PRODUCTION_PROXY_TOKEN
  });

  try {
    const upstreamRequest = new Request(
      "https://production-api.internal/api/submissions",
      {
        method: "POST",
        headers,
        body: request.body,
        duplex: "half"
      }
    );

    const response =
      await env.PRODUCTION_API.fetch(upstreamRequest);

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
      "Production API is unavailable",
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

