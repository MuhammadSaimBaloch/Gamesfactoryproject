import {
  Form,
  Link,
  redirect,
  data,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { z } from "zod";
import { environmentContext } from "../lib/context";
import {
  consumeSignIn,
  currentCustomer,
  requireCustomer,
  requestSignIn,
  sessionCookie,
  tokenHash,
  decryptCode,
} from "../lib/server/customers";
import { rateLimit, sameOrigin } from "../lib/server/security";
import { emailInput, type Inquiry } from "../lib/server/storefront";
import { money } from "../lib/money";
import { customerSchema } from "../lib/validation/commerce";
export const meta = () => [
  { title: "Your account | Games Factory Pakistan" },
  { name: "robots", content: "noindex,nofollow" },
];
export async function loader({ request, context, url }: LoaderFunctionArgs) {
  const env = context.get(environmentContext);
  const customer = await currentCustomer(request, env);
  const token =
    url.pathname === "/account/verify" ? url.searchParams.get("token") : null;
  if (!customer)
    return data(
      {
        customer: null,
        token,
        addresses: [],
        orders: [],
        inquiries: [],
        deliveries: [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  const addresses = (
    await env.DB.prepare(
      "SELECT id,label,data FROM customer_addresses WHERE customer_id=? ORDER BY label",
    )
      .bind(customer.id)
      .all<{ id: string; label: string; data: string }>()
  ).results;
  const orders = (
    await env.DB.prepare(
      "SELECT o.id,o.order_number AS number,o.status,o.total_pkr AS total,o.created_at AS createdAt FROM orders o JOIN customer_orders co ON co.order_id=o.id WHERE co.customer_id=? ORDER BY o.created_at DESC LIMIT 100",
    )
      .bind(customer.id)
      .all<{
        id: string;
        number: string;
        status: string;
        total: number;
        createdAt: string;
      }>()
  ).results;
  const inquiries = (
    await env.DB.prepare(
      "SELECT * FROM store_inquiries WHERE customer_id=? AND kind='preorder' ORDER BY created_at DESC LIMIT 100",
    )
      .bind(customer.id)
      .all<Inquiry>()
  ).results;
  const codes = (
    await env.DB.prepare(
      "SELECT d.item_id,d.ciphertext,oi.product_name_snapshot AS name,o.order_number AS number FROM digital_deliveries d JOIN customer_orders co ON co.order_id=d.order_id JOIN orders o ON o.id=d.order_id JOIN order_items oi ON oi.id=d.item_id WHERE co.customer_id=? AND o.status='COMPLETED'",
    )
      .bind(customer.id)
      .all<{
        item_id: string;
        ciphertext: string;
        name: string;
        number: string;
      }>()
  ).results;
  const deliveries = await Promise.all(
    codes.map(async (c) => ({
      name: c.name,
      number: c.number,
      code: await decryptCode(env, c.ciphertext, c.item_id),
    })),
  );
  return data(
    { customer, token: null, addresses, orders, inquiries, deliveries },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.get(environmentContext);
  try {
    sameOrigin(request);
    if (request.method !== "POST")
      throw new Response("Method not allowed", { status: 405 });
    const form = await request.formData();
    const intent = String(form.get("intent"));
    if (intent === "signin") {
      await rateLimit(request, env);
      const email = emailInput.parse(form.get("email"));
      const name = z
        .string()
        .trim()
        .max(120)
        .parse(form.get("name") || "");
      return {
        ...(await requestSignIn(request, env, email, name)),
        error: false,
      };
    }
    if (intent === "verify") {
      await rateLimit(request, env);
      const token = z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(form.get("token"));
      const session = await consumeSignIn(request, env, token);
      return redirect("/account", {
        headers: { "Set-Cookie": sessionCookie(session, request) },
      });
    }
    const customer = await requireCustomer(request, env);
    if (intent === "logout") {
      const token =
        request.headers
          .get("cookie")
          ?.split(";")
          .map((v) => v.trim())
          .find((v) => v.startsWith("gfp_session="))
          ?.slice(12) || "";
      await env.DB.prepare("DELETE FROM customer_sessions WHERE hash=?")
        .bind(await tokenHash(token))
        .run();
      return redirect("/account", {
        headers: { "Set-Cookie": sessionCookie("", request, 0) },
      });
    }
    if (intent === "delete-address") {
      await env.DB.prepare(
        "DELETE FROM customer_addresses WHERE id=? AND customer_id=?",
      )
        .bind(String(form.get("id")), customer.id)
        .run();
      return { message: "Address removed.", error: false, previewLink: null };
    }
    if (intent === "address") {
      const address = customerSchema.parse({
        ...Object.fromEntries(form),
        email: customer.email,
        notes: "",
      });
      const label = z.string().trim().min(1).max(80).parse(form.get("label"));
      if (!address.address || !address.city || !address.province)
        throw new Response("Street address, city and province are required.", {
          status: 400,
        });
      const count = await env.DB.prepare(
        "SELECT count(*) AS n FROM customer_addresses WHERE customer_id=?",
      )
        .bind(customer.id)
        .first<{ n: number }>();
      if ((count?.n || 0) >= 10)
        throw new Response("You can save up to 10 addresses.", { status: 400 });
      await env.DB.prepare(
        "INSERT INTO customer_addresses(id,customer_id,label,data) VALUES(?,?,?,?)",
      )
        .bind(crypto.randomUUID(), customer.id, label, JSON.stringify(address))
        .run();
      return { message: "Address saved.", error: false, previewLink: null };
    }
    throw new Response("Unknown action", { status: 400 });
  } catch (e) {
    return data(
      {
        message:
          e instanceof Response
            ? await e.text()
            : e instanceof z.ZodError
              ? e.issues.map((i) => i.message).join(" · ")
              : "Unable to complete the request. Try again.",
        error: true,
        previewLink: null,
      },
      {
        status: e instanceof Response ? e.status : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export default function Account() {
  const d = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  return (
    <div className="page account-page">
      <span className="eyebrow">GAMES FACTORY / YOUR SPACE</span>
      <h1>{d.customer ? "YOUR ACCOUNT." : "WELCOME BACK."}</h1>
      {result && (
        <div className="notice" role="status">
          {result.message}
          {result.previewLink && (
            <p>
              <Link className="text-link" to={result.previewLink}>
                Open local sign-in link ↗
              </Link>
            </p>
          )}
        </div>
      )}
      {!d.customer ? (
        d.token ? (
          <Form method="post" className="admin-form">
            <h2>Confirm your sign-in</h2>
            <p>Continue to securely sign in with your email link.</p>
            <input type="hidden" name="intent" value="verify" />
            <input type="hidden" name="token" value={d.token} />
            <button className="button" disabled={busy}>
              Sign in
            </button>
          </Form>
        ) : (
          <Form method="post" className="admin-form">
            <h2>Sign in or create an account</h2>
            <p>
              We’ll email you a secure sign-in link. No password to remember.
            </p>
            <input type="hidden" name="intent" value="signin" />
            <label>
              Your name (for a new account)
              <input name="name" maxLength={120} autoComplete="name" />
            </label>
            <label>
              Email
              <input type="email" name="email" required autoComplete="email" />
            </label>
            <button className="button" disabled={busy}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            <p>
              By continuing you agree to our{" "}
              <Link className="text-link" to="/privacy">
                privacy policy
              </Link>
              .
            </p>
          </Form>
        )
      ) : (
        <>
          <div className="account-heading">
            <p>
              {d.customer.name} · {d.customer.email}
            </p>
            <Form method="post">
              <input type="hidden" name="intent" value="logout" />
              <button className="text-link">Sign out</button>
            </Form>
          </div>
          <section className="section">
            <h2>YOUR ORDERS.</h2>
            <p>
              Orders placed while signed in appear here. An order request awaits
              staff confirmation and payment.
            </p>
            {!d.orders.length && (
              <p>
                No orders yet.{" "}
                <Link className="text-link" to="/shop">
                  Explore the collection ↗
                </Link>
              </p>
            )}
            {d.orders.map((o) => (
              <article className="account-card" key={o.id}>
                <strong>{o.number}</strong>
                <span>{o.status.replaceAll("_", " ")}</span>
                <span>{money(o.total)}</span>
                <time>{o.createdAt}</time>
              </article>
            ))}
          </section>
          {!!d.inquiries.length && (
            <section className="section">
              <h2>PRE-ORDER REQUESTS.</h2>
              {d.inquiries.map((i) => (
                <article className="account-card" key={i.id}>
                  <strong>{i.message}</strong>
                  <span>{i.status}</span>
                  <span>Quantity: {i.quantity}</span>
                </article>
              ))}
            </section>
          )}
          {!!d.deliveries.length && (
            <section className="section">
              <h2>YOUR DIGITAL CODES.</h2>
              {d.deliveries.map((c, i) => (
                <article className="account-card" key={i}>
                  <strong>
                    {c.name} · {c.number}
                  </strong>
                  <code>{c.code}</code>
                </article>
              ))}
            </section>
          )}
          <section className="section">
            <h2>SAVED ADDRESSES.</h2>
            <div className="address-grid">
              {d.addresses.map((a) => {
                const address = JSON.parse(a.data) as {
                  name: string;
                  address: string;
                  city: string;
                  province: string;
                  phone: string;
                };
                return (
                  <article className="account-card" key={a.id}>
                    <h3>{a.label}</h3>
                    <p>
                      {address.name}
                      <br />
                      {address.address}
                      <br />
                      {address.city}, {address.province}
                      <br />
                      {address.phone}
                    </p>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="delete-address"
                      />
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-link">Remove address</button>
                    </Form>
                  </article>
                );
              })}
            </div>
            <Form method="post" className="admin-form">
              <h3>Add an address</h3>
              <input type="hidden" name="intent" value="address" />
              <div className="form-grid">
                {[
                  ["label", "Address label"],
                  ["name", "Recipient name"],
                  ["phone", "Phone"],
                  ["address", "Street address"],
                  ["city", "City"],
                  ["province", "Province"],
                  ["postalCode", "Postal code (optional)"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      name={key}
                      required={key !== "postalCode"}
                      maxLength={key === "address" ? 500 : 120}
                    />
                  </label>
                ))}
              </div>
              <button className="button" disabled={busy}>
                Save address
              </button>
            </Form>
          </section>
        </>
      )}
    </div>
  );
}
