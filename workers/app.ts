import { createRequestHandler, RouterContextProvider } from "react-router";
import { environmentContext, nonceContext } from "../app/lib/context";
import type { Env } from "../app/types/env";
const handler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);
export default {
  async fetch(incoming, env) {
    let request: Request = incoming;
    // Bound and drain mutation bodies before dispatch, including requests rejected by auth/CSRF.
    // This also avoids an unread-body connection reuse failure in local workerd/Miniflare.
    if (["POST", "PUT", "PATCH"].includes(request.method) && request.body) {
      const limit = new URL(request.url).pathname.startsWith("/admin")
        ? 9 * 1024 * 1024
        : 24000;
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.length;
        if (length > limit) {
          await reader.cancel();
          return new Response("Request too large", { status: 413 });
        }
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: bytes,
        redirect: request.redirect,
      });
    }
    const nonce = btoa(crypto.randomUUID());
    const context = new RouterContextProvider();
    context.set(environmentContext, env);
    context.set(nonceContext, nonce);
    const response = await handler(request, context);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", new URL(request.url).pathname.startsWith('/account')||new URL(request.url).pathname.startsWith('/services')?'no-referrer':'same-origin');
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    headers.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com ${env.ENVIRONMENT === "local" ? "'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com ${env.ENVIRONMENT === "local" ? "ws: http://127.0.0.1:*" : ""}; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
    );
    if (env.ENVIRONMENT !== "local")
      headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    if (
      new URL(request.url).pathname.startsWith("/admin") ||
      new URL(request.url).pathname.startsWith("/account") ||
      new URL(request.url).pathname.startsWith("/checkout") ||
      new URL(request.url).pathname.startsWith("/services") ||
      new URL(request.url).pathname.startsWith("/api/orders")
    )
      headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
