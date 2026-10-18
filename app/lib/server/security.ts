import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../../types/env";
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new Response("Request origin rejected", { status: 403 });
}
export async function requireAdmin(request: Request, env: Env) {
  const local =
    env.ENVIRONMENT === "local" &&
    ["127.0.0.1", "localhost"].includes(new URL(request.url).hostname);
  if (local && env.LOCAL_ADMIN_EMAIL) return env.LOCAL_ADMIN_EMAIL;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_ISSUER || !env.ACCESS_AUD)
    throw new Response("Administrator access required", { status: 403 });
  try {
    const { payload } = await jwtVerify(
      token,
      createRemoteJWKSet(new URL("/cdn-cgi/access/certs", env.ACCESS_ISSUER)),
      {
        issuer: env.ACCESS_ISSUER,
        audience: env.ACCESS_AUD,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "iat", "email"],
      },
    );
    const email = String(payload.email ?? "").toLowerCase();
    if (
      !env.ADMIN_EMAILS?.split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(email)
    )
      throw Error();
    return email;
  } catch {
    throw new Response("Administrator access required", { status: 403 });
  }
}
export async function rateLimit(request: Request, env: Env) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    (env.ENVIRONMENT === "local" ? "local" : null);
  if (!ip) throw new Response("Unable to validate request", { status: 403 });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip),
  );
  const key =
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("") +
    ":" +
    Math.floor(Date.now() / 60000);
  const result = await env.DB.prepare(
    "INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(key, Date.now() + 120000)
    .first<{ count: number }>();
  if ((result?.count ?? 99) > 10)
    throw new Response("Too many attempts. Please wait a minute.", {
      status: 429,
    });
  await env.DB.prepare("DELETE FROM rate_limits WHERE expires < ?")
    .bind(Date.now())
    .run();
}
export async function verifyBot(token: string, request: Request, env: Env) {
  if (!env.TURNSTILE_SECRET)
    throw new Response("Checkout is waiting for store configuration.", {
      status: 503,
    });
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") || "",
      }),
    },
  );
  const value = (await response.json()) as {
    success: boolean;
    hostname?: string;
    action?: string;
  };
  if (
    !value.success ||
    value.hostname !== new URL(request.url).hostname ||
    value.action !== "checkout"
  )
    throw new Response("Please complete the security check again.", {
      status: 400,
    });
}
export async function jsonBody(request: Request, max = 24000) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new Response("Request too large", { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) throw new Response("Missing request", { status: 400 });
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > max) {
      await reader.cancel();
      throw new Response("Request too large", { status: 413 });
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Response("Invalid JSON", { status: 400 });
  }
}
