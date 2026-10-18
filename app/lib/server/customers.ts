import type { Env } from "../../types/env";
export const localRequest = (request: Request, env: Env) =>
  env.ENVIRONMENT === "local" &&
  ["127.0.0.1", "localhost"].includes(new URL(request.url).hostname);
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function tokenHash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  text: string,
) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM)
    throw new Response(
      "Email delivery is not configured. Please contact the store.",
      { status: 503 },
    );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Response("Email could not be sent. Please try again later.", {
      status: 503,
    });
}
export interface Customer {
  id: string;
  email: string;
  name: string;
}
export async function currentCustomer(
  request: Request,
  env: Env,
): Promise<Customer | null> {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("gfp_session="))
    ?.slice(12);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return env.DB.prepare(
    "SELECT c.id,c.email,c.name FROM customers c JOIN customer_sessions s ON s.customer_id=c.id WHERE s.hash=? AND s.expires>?",
  )
    .bind(await tokenHash(token), Date.now())
    .first<Customer>();
}
export async function requireCustomer(request: Request, env: Env) {
  const customer = await currentCustomer(request, env);
  if (!customer)
    throw new Response("Sign in to your account to continue.", { status: 401 });
  return customer;
}
export function sessionCookie(
  token: string,
  request: Request,
  maxAge = 604800,
) {
  return `gfp_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function requestSignIn(
  request: Request,
  env: Env,
  email: string,
  name: string,
) {
  const token = randomToken();
  const hash = await tokenHash(token);
  await env.DB.prepare(
    "INSERT INTO customer_tokens(hash,email,name,purpose,expires) VALUES(?,?,?,?,?)",
  )
    .bind(hash, email, name, "signin", Date.now() + 15 * 60 * 1000)
    .run();
  const url = new URL("/account/verify", env.SITE_URL);
  url.searchParams.set("token", token);
  if (
    localRequest(request, env) &&
    env.DEMO_MODE === "true" &&
    !env.RESEND_API_KEY
  )
    return {
      message:
        "Local preview: use the sign-in link below. Production sends it to your email.",
      previewLink: url.href,
    };
  try {
    await sendEmail(
      env,
      email,
      "Your Games Factory sign-in link",
      `Sign in to Games Factory Pakistan: ${url.href}\n\nThis link expires in 15 minutes and can be used once. If you did not request it, ignore this email.`,
    );
  } catch (e) {
    await env.DB.prepare("DELETE FROM customer_tokens WHERE hash=?")
      .bind(hash)
      .run();
    throw e;
  }
  return {
    message: "Check your email for a sign-in link. It expires in 15 minutes.",
    previewLink: null,
  };
}
export async function consumeSignIn(request: Request, env: Env, token: string) {
  const row = await env.DB.prepare(
    "DELETE FROM customer_tokens WHERE hash=? AND purpose='signin' AND expires>? RETURNING email,name",
  )
    .bind(await tokenHash(token), Date.now())
    .first<{ email: string; name: string }>();
  if (!row)
    throw new Response(
      "This sign-in link has expired or was already used. Request a new link.",
      { status: 400 },
    );
  await env.DB.prepare(
    "INSERT INTO customers(id,email,name) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING",
  )
    .bind(crypto.randomUUID(), row.email, row.name)
    .run();
  const customer = await env.DB.prepare(
    "SELECT id FROM customers WHERE email=?",
  )
    .bind(row.email)
    .first<{ id: string }>();
  const session = randomToken();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO customer_sessions(hash,customer_id,expires) VALUES(?,?,?)",
    ).bind(await tokenHash(session), customer!.id, Date.now() + 604800000),
    env.DB.prepare("DELETE FROM customer_sessions WHERE expires<?").bind(
      Date.now(),
    ),
    env.DB.prepare("DELETE FROM customer_tokens WHERE expires<?").bind(
      Date.now(),
    ),
  ]);
  return session;
}
export async function digitalKey(env: Env) {
  if (
    !env.DIGITAL_DELIVERY_KEY ||
    !/^[a-f0-9]{64}$/.test(env.DIGITAL_DELIVERY_KEY)
  )
    throw new Response("Digital delivery encryption is not configured.", {
      status: 503,
    });
  return crypto.subtle.importKey(
    "raw",
    Uint8Array.from(env.DIGITAL_DELIVERY_KEY.match(/../g)!, (h) =>
      parseInt(h, 16),
    ),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptCode(env: Env, code: string, itemId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(itemId) },
    await digitalKey(env),
    new TextEncoder().encode(code),
  );
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...new Uint8Array(bytes)))}`;
}
export async function decryptCode(env: Env, value: string, itemId: string) {
  const [iv, data] = value
    .split(".")
    .map((p) => Uint8Array.from(atob(p), (c) => c.charCodeAt(0)));
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(itemId) },
      await digitalKey(env),
      data,
    ),
  );
}
