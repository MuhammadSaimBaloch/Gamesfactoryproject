import { environmentContext, nonceContext } from "../lib/context";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { useEffect, useRef, useState } from "react";
import { useCart } from "../lib/cart";
import { money } from "../lib/money";
import { siteData } from "../lib/server/catalog";
import { checkoutSchema } from "../lib/validation/commerce";
import { seo } from "../lib/seo";
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
export const meta = () =>
  seo("Checkout", "Prepare an order request for Games Factory Pakistan.");
export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.get(environmentContext);
  const data = await siteData(env);
  return {
    paymentPolicy: data.settings.payment_policy || "",
    branches: data.branches.filter((b) => b.pickupEnabled),
    siteKey: env.TURNSTILE_SITE_KEY,
    ready:
      data.settings.whatsapp_verified === "true" &&
      Boolean(env.TURNSTILE_SECRET) &&
      Boolean(env.TURNSTILE_SITE_KEY),
    nonce: context.get(nonceContext),
  };
}
interface Result {
  number: string;
  message: string;
  url: string;
  copyRequired: boolean;
  subtotal: number;
  shipping: number;
  total: number;
  status: string;
}
export default function Checkout() {
  const config = useLoaderData<typeof loader>();
  const items = useCart((s) => s.items);
  const hasDigital = items.some((item) =>
    ["gift-card", "digital-game"].includes(item.type),
  );
  const digitalOnly =
    items.length > 0 &&
    items.every((i) => ["gift-card", "digital-game"].includes(i.type));
  const [fulfillment, setFulfillment] = useState("delivery");
  useEffect(() => {
    setFulfillment(digitalOnly ? "digital" : "delivery");
    setQuote(null);
  }, [digitalOnly]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [quote, setQuote] = useState<{
    subtotal: number;
    shipping: number;
    total: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef("");
  const requestKey = useRef("");
  useEffect(() => {
    requestKey.current =
      sessionStorage.getItem("gfp-order-key") || crypto.randomUUID();
    sessionStorage.setItem("gfp-order-key", requestKey.current);
    if (!config.siteKey) return;
    let cancelled = false;
    const mount = () => {
      if (!cancelled && widget.current && window.turnstile)
        widgetId.current = window.turnstile.render(widget.current, {
          sitekey: config.siteKey,
          action: "checkout",
          theme: "light",
          callback: (value: string) => setToken(value),
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
    };
    const existing = document.querySelector("script[data-turnstile]");
    if (window.turnstile) mount();
    else if (existing) existing.addEventListener("load", mount);
    else {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.dataset.turnstile = "true";
      script.nonce = config.nonce;
      script.onload = mount;
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
  }, [config.siteKey, config.nonce]);
  function payload() {
    const f = new FormData(form.current!);
    const str = (n: string) => String(f.get(n) || "");
    return {
      items: items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      customer: {
        name: str("name"),
        phone: str("phone"),
        email: str("email"),
        province: str("province"),
        city: str("city"),
        address: str("address"),
        postalCode: str("postalCode"),
        notes: str("notes"),
      },
      fulfillment,
      branchId: str("branchId"),
      idempotencyKey: requestKey.current,
      token,
      acceptedTotal: quote?.total,
      consent: f.get("consent") === "on",
    };
  }
  async function submit(order: boolean) {
    setError("");
    if (!form.current?.reportValidity()) return;
    const input = payload();
    if (order) {
      const validation = checkoutSchema.safeParse(input);
      if (!validation.success) {
        setError(
          validation.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(" · "),
        );
        return;
      }
    }
    setBusy(true);
    try {
      const response = await fetch(
        order ? "/api/orders/whatsapp" : "/api/orders/quote",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        throw Error(
          text.startsWith("{")
            ? (JSON.parse(text) as { error: string }).error
            : text,
        );
      }
      const data = await response.json();
      if (order) {
        setResult(data as Result);
        sessionStorage.removeItem("gfp-order-key");
        if (!(data as Result).copyRequired)
          window.location.assign((data as Result).url);
      } else
        setQuote(data as { subtotal: number; shipping: number; total: number });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to prepare the order. Please retry.",
      );
      if (order) {
        window.turnstile?.reset(widgetId.current);
        setToken("");
      }
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <div className="page narrow">
        <span className="eyebrow">ORDER REQUEST PREPARED</span>
        <h1>ONE LAST STEP.</h1>
        <p>
          Request <strong>{result.number}</strong> is saved. Open WhatsApp and
          press Send to contact Games Factory Pakistan.
        </p>
        <p>This is not a confirmed order or payment. Your bag is retained.</p>
        {result.copyRequired && (
          <p className="notice">
            This request is too long for a reliable prefilled link. Copy the
            complete message and paste it into the store chat.
          </p>
        )}
        <div className="button-row">
          <a className="button" href={result.url} rel="noreferrer">
            Open WhatsApp ↗
          </a>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.message);
                setCopied(true);
              } catch {
                setError("Copy the message manually from the box below.");
              }
            }}
          >
            {copied ? "Copied" : "Copy order message"}
          </button>
        </div>
        <p role="status">{error}</p>
        <label>
          Complete order message
          <textarea readOnly rows={18} value={result.message} />
        </label>
        <p>
          Total: <strong>{money(result.total)}</strong>
        </p>
      </div>
    );
  return (
    <div className="page">
      <span className="eyebrow">YOUR NEXT GAME STARTS HERE</span>
      <h1>LET’S MAKE IT HAPPEN.</h1>
      {!config.ready && (
        <div className="notice">
          Online ordering is awaiting owner setup: verified store WhatsApp
          number and security configuration. You can still explore the
          catalogue.
        </div>
      )}
      {hasDigital ? (
        <div className="notice">
          Please <Link to="/contact">contact our team</Link> to arrange digital
          products. Physical products can be ordered separately through guest
          checkout.
        </div>
      ) : items.length ? (
        <div className="checkout-layout">
          <form
            ref={form}
            onSubmit={(e) => {
              e.preventDefault();
              void submit(true);
            }}
            onChange={() => setQuote(null)}
          >
            <fieldset>
              <legend>01 / Your details</legend>
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                  />
                </label>
                <label>
                  Mobile / WhatsApp
                  <input
                    name="phone"
                    required
                    type="tel"
                    placeholder="03XX XXXXXXX"
                    autoComplete="tel"
                  />
                </label>
                <label className="wide">
                  Email <span className="muted">(optional)</span>
                  <input name="email" type="email" autoComplete="email" />
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend>02 / How would you like it?</legend>
              <div className="fulfillment">
                <label className="check">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="delivery"
                    disabled={digitalOnly}
                    checked={fulfillment === "delivery"}
                    onChange={() => setFulfillment("delivery")}
                  />{" "}
                  Delivery in Pakistan
                </label>
                <label className="check">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="pickup"
                    disabled={digitalOnly}
                    checked={fulfillment === "pickup"}
                    onChange={() => setFulfillment("pickup")}
                  />{" "}
                  Branch pickup
                </label>
                {digitalOnly && (
                  <label className="check">
                    <input
                      type="radio"
                      name="fulfillment"
                      value="digital"
                      checked={fulfillment === "digital"}
                      onChange={() => setFulfillment("digital")}
                    />
                    Digital delivery arranged with our team
                  </label>
                )}
              </div>
              {fulfillment === "digital" ? (
                <p>
                  Contact our team to arrange digital code payment and delivery.
                </p>
              ) : fulfillment === "delivery" ? (
                <div className="form-grid">
                  <label>
                    Province / territory
                    <select name="province" required defaultValue="">
                      <option value="" disabled>
                        Select
                      </option>
                      {[
                        "Punjab",
                        "Sindh",
                        "Khyber Pakhtunkhwa",
                        "Balochistan",
                        "Islamabad Capital Territory",
                        "Gilgit-Baltistan",
                        "Azad Jammu and Kashmir",
                      ].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    City
                    <input
                      name="city"
                      required
                      maxLength={80}
                      autoComplete="address-level2"
                    />
                  </label>
                  <label className="wide">
                    Delivery address
                    <input
                      name="address"
                      required
                      maxLength={300}
                      autoComplete="street-address"
                    />
                  </label>
                  <label>
                    Postal code (optional)
                    <input
                      name="postalCode"
                      maxLength={12}
                      autoComplete="postal-code"
                    />
                  </label>
                </div>
              ) : (
                <label>
                  Pickup branch
                  <select name="branchId" required defaultValue="">
                    <option value="">Select an available branch</option>
                    {config.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}, {b.city}
                      </option>
                    ))}
                  </select>
                  {!config.branches.length && (
                    <span className="muted">
                      Pickup is awaiting store configuration.
                    </span>
                  )}
                </label>
              )}
            </fieldset>
            <label>
              Additional notes (optional)
              <input name="notes" maxLength={500} />
            </label>
            <label className="check consent">
              <input name="consent" type="checkbox" required />{" "}
              <span>
                I agree to include these details in a WhatsApp message that I
                will review and send. Read our{" "}
                <Link to="/privacy">privacy information</Link>.
              </span>
            </label>
            <div ref={widget} />
            <div role="alert" className="form-error">
              {error}
            </div>
            <button
              className="button full"
              disabled={busy || !config.ready || !token || !quote}
            >
              {busy ? "Preparing your request…" : "Place Order via WhatsApp ↗"}
            </button>
            <p className="muted">
              First calculate your total using the order summary. No payment is
              collected here.
            </p>
            {config.paymentPolicy && (
              <details>
                <summary>Accepted payment methods</summary>
                <p className="preserve">{config.paymentPolicy}</p>
                <p>
                  Wait for staff to confirm your order and total before
                  transferring payment.
                </p>
              </details>
            )}
          </form>
          <aside className="checkout-summary">
            <h2>Your selection</h2>
            {items.map((i) => (
              <div className="summary-item" key={i.variantId}>
                <div>
                  <strong>{i.name}</strong>
                  <p>
                    {i.variant} × {i.quantity}
                  </p>
                </div>
                <span>{money(i.price * i.quantity)}</span>
              </div>
            ))}
            <p className="muted">
              Listed prices are estimates until checked against current stock.
            </p>
            <button
              type="button"
              className="button secondary full"
              disabled={busy}
              onClick={() => void submit(false)}
            >
              Check availability & calculate total
            </button>
            {quote && (
              <div aria-live="polite">
                <div className="row">
                  <span>Current subtotal</span>
                  <strong>{money(quote.subtotal)}</strong>
                </div>
                <div className="row">
                  <span>Shipping</span>
                  <strong>{money(quote.shipping)}</strong>
                </div>
                <div className="row total">
                  <span>Total</span>
                  <strong>{money(quote.total)}</strong>
                </div>
              </div>
            )}
            <Link className="text-link" to="/cart">
              Edit your bag
            </Link>
          </aside>
        </div>
      ) : (
        <div className="empty">
          <h2>Your bag is empty.</h2>
          <Link className="button" to="/shop">
            Explore the collection
          </Link>
        </div>
      )}
    </div>
  );
}
