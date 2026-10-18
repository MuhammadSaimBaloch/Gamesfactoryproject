import { environmentContext } from "../lib/context";
import {
  Link,
  useLoaderData,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { siteData } from "../lib/server/catalog";
import { seo } from "../lib/seo";
import { InquiryForm } from "../components/store-forms";
export async function loader({ url, context }: LoaderFunctionArgs) {
  return {
    ...(await siteData(context.get(environmentContext))),
    path: url.pathname,
    productInquiry: url.searchParams.get("product")?.slice(0, 160) || "",
    canonical: context.get(environmentContext).SITE_URL + url.pathname,
  };
}
export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  seo(
    (
      {
        "/about": "Our story",
        "/branches": "Our Multan branches",
        "/contact": "Contact us",
        "/faq": "Frequently asked questions",
        "/policies/shipping": "Shipping information",
        "/policies/returns": "Returns information",
        "/privacy": "Privacy information",
        "/policies/payment": "Payment information",
        "/policies/warranty": "Warranty information",
      } as Record<string, string>
    )[loaderData?.path || ""] || "Store information",
    "Visit Games Factory Pakistan in Babar Market or Emirates Mall, Multan.",
    loaderData?.canonical,
  );
export default function Information() {
  const { path, settings, branches, productInquiry } =
    useLoaderData<typeof loader>();
  const policy =
    path === "/privacy"
      ? "privacy_policy"
      : path === "/policies/shipping"
        ? "shipping_policy"
        : path === "/policies/returns"
          ? "returns_policy"
          : path === "/policies/payment"
            ? "payment_policy"
            : path === "/policies/warranty"
              ? "warranty_policy"
              : null;
  return (
    <div className="page narrow prose">
      <span className="eyebrow">GAMES FACTORY PAKISTAN</span>
      {policy ? (
        <>
          <h1>
            {policy === "privacy_policy"
              ? "PRIVACY."
              : policy === "shipping_policy"
                ? "DELIVERY."
                : policy === "payment_policy"
                  ? "PAYMENT."
                  : policy === "warranty_policy"
                    ? "WARRANTY."
                    : "RETURNS."}
          </h1>
          <p className="preserve">
            {settings[policy] ||
              "Please contact our team to confirm the terms that apply to your product before ordering."}
          </p>
          {policy === "shipping_policy" && settings.delivery_estimates && (
            <p className="preserve">{settings.delivery_estimates}</p>
          )}
          {policy === "privacy_policy" && (
            <p>
              Checkout collects your contact and fulfillment details to prepare
              an order request. The message is included in a WhatsApp link,
              which you review and send yourself. Order requests are stored for
              staff handling. Contact our team with questions about your
              information.
            </p>
          )}
        </>
      ) : path === "/branches" ? (
        <>
          <h1>COME SAY HELLO.</h1>
          <p>
            Two branches. One shared love for gaming. Find us in Multan, Punjab.
          </p>
          {branches.map((b, i) => (
            <article className="branch-card" key={b.id}>
              <span className="eyebrow">0{i + 1} / MULTAN</span>
              <h2>{b.name}</h2>
              <p>{b.address || "Contact our team for directions."}</p>
              <p>{b.hours || "Contact us for current opening hours."}</p>
              {b.phone && (
                <a className="text-link" href={`tel:${b.phone}`}>
                  {b.phone}
                </a>
              )}
              {b.mapUrl && (
                <a
                  className="button secondary"
                  href={b.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get directions ↗
                </a>
              )}
              <p>
                {b.pickupEnabled
                  ? "Pickup requests available; wait for staff confirmation."
                  : "Pickup availability awaiting confirmation."}
              </p>
            </article>
          ))}
        </>
      ) : path === "/contact" ? (
        <>
          <h1>LET’S TALK PLAY.</h1>
          <p>
            For product availability, orders and gaming questions, connect with
            our team.
          </p>
          {settings.whatsapp_verified === "true" &&
          /^923\d{9}$/.test(settings.whatsapp_number || "") ? (
            <a
              className="button"
              href={`https://wa.me/${settings.whatsapp_number}`}
            >
              Chat on WhatsApp ↗
            </a>
          ) : (
            <p>
              Our verified WhatsApp contact will be published after owner
              confirmation.
            </p>
          )}
          <Link className="text-link" to="/branches">
            Visit a Multan branch ↗
          </Link>
          {["instagram", "facebook", "tiktok"]
            .filter((k) => settings[k])
            .map((k) => (
              <a
                className="text-link"
                rel="noreferrer"
                target="_blank"
                href={settings[k]}
                key={k}
              >
                {k} ↗
              </a>
            ))}
          <InquiryForm
            enabled={settings.contact_enabled === "true"}
            message={
              productInquiry
                ? `Please confirm the price and availability of ${productInquiry}.`
                : ""
            }
          />
        </>
      ) : path === "/faq" ? (
        <>
          <h1>GOOD QUESTIONS.</h1>
          {[
            ["Delivery times", settings.delivery_estimates],
            ["Payment methods", settings.payment_policy],
            ["Warranty", settings.warranty_policy],
            ["Authenticity", settings.authenticity_policy],
          ]
            .filter(([, answer]) => answer)
            .map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p className="preserve">{answer}</p>
              </details>
            ))}
          {[
            [
              "How do I place an order?",
              "Add items to your bag, complete checkout, and send the prepared message in WhatsApp. Our staff will confirm availability and next steps.",
            ],
            [
              "Does checkout confirm my purchase?",
              "No. Your request is saved while awaiting your WhatsApp message. It is not a payment confirmation or a stock reservation.",
            ],
            [
              "Can I collect from a branch?",
              "Choose an enabled branch at checkout. Wait for our team to confirm availability and the collection time.",
            ],
            [
              "What are the delivery and warranty terms?",
              "Only owner-approved terms apply. Please check the published policies or contact the team before ordering.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </>
      ) : (
        <>
          <h1>
            FOR THE LOVE
            <br />
            OF THE GAME.
          </h1>
          <p className="lead">
            Games Factory Pakistan is a gaming retailer based in Multan, with
            physical branches in Babar Market and Emirates Mall, Shalimar
            Colony.
          </p>
          <p>
            Explore consoles, video games, controllers and gaming accessories.
            Discover your next setup online, then speak with our team to confirm
            product availability and your order details.
          </p>
          <Link className="button" to="/branches">
            Find your branch ↗
          </Link>
        </>
      )}
    </div>
  );
}
