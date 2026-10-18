import {
  Form,
  Link,
  data,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { z } from "zod";
import { environmentContext } from "../lib/context";
import { sameOrigin, rateLimit } from "../lib/server/security";
import { currentCustomer, tokenHash } from "../lib/server/customers";
import { inquiryInput, getDetails } from "../lib/server/storefront";
import { siteData } from "../lib/server/catalog";
export const meta = () => [
  { title: "Store updates | Games Factory Pakistan" },
  { name: "robots", content: "noindex,nofollow" },
];
export async function loader({ request, params }: LoaderFunctionArgs) {
  if (params["*"] !== "unsubscribe")
    throw new Response("Not found", { status: 404 });
  return data(
    {
      path: params["*"],
      token: new URL(request.url).searchParams.get("token") || "",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}
export async function action({ request, params, context }: ActionFunctionArgs) {
  const env = context.get(environmentContext);
  try {
    sameOrigin(request);
    if (request.method !== "POST")
      throw new Response("Method not allowed", { status: 405 });
    await rateLimit(request, env);
    const form = await request.formData();
    const path = params["*"];
    if (path === "newsletter" || path === "confirm")
      throw new Response("Email subscriptions are no longer available.", {
        status: 410,
      });
    if (path === "unsubscribe") {
      const hash = await tokenHash(
        z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .parse(form.get("token")),
      );
      await env.DB.prepare(
        "UPDATE newsletter_subscribers SET status='unsubscribed' WHERE unsubscribe_hash=?",
      )
        .bind(hash)
        .run();
      return {
        message: "Your subscription preference has been updated.",
        previewLink: null,
      };
    }
    const { settings } = await siteData(env);
    if (path === "contact" || path === "preorder") {
      if (
        settings[
          path === "contact" ? "contact_enabled" : "preorders_enabled"
        ] !== "true"
      )
        throw new Response(
          "Online requests are not available yet. Please contact a branch.",
          { status: 503 },
        );
      const input = inquiryInput.parse(Object.fromEntries(form));
      const customer = await currentCustomer(request, env);
      let productId: null | string = null,
        variantId: null | string = null,
        quantity = 1,
        message = input.message;
      if (path === "preorder") {
        productId = z.string().max(80).parse(form.get("productId"));
        variantId = z.string().max(80).parse(form.get("variantId"));
        quantity = z.coerce
          .number()
          .int()
          .min(1)
          .max(20)
          .parse(form.get("quantity"));
        const p = await env.DB.prepare(
          "SELECT p.name,v.name AS variant FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.id=? AND v.id=? AND p.active=1 AND v.available=1 AND (?=1 OR p.demo=0)",
        )
          .bind(productId, variantId, env.DEMO_MODE === "true" ? 1 : 0)
          .first<{ name: string; variant: string }>();
        const details = await getDetails(env, productId);
        if (!p || details?.saleMode !== "preorder")
          throw new Response("This item is not accepting pre-orders.", {
            status: 409,
          });
        message = `${p.name} / ${p.variant}\nRelease: ${details.releaseDate || "To be confirmed"}\nTerms accepted: ${details.depositTerms}\nCustomer note: ${input.message}`;
      }
      await env.DB.prepare(
        "INSERT INTO store_inquiries(id,kind,customer_id,name,email,phone,message,product_id,variant_id,quantity) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          path,
          customer?.id || null,
          input.name,
          input.email,
          input.phone,
          message,
          productId,
          variantId,
          quantity,
        )
        .run();
      return {
        message:
          path === "preorder"
            ? "Your pre-order request is saved. Our team will confirm availability and payment terms. No payment was taken and no stock is reserved."
            : "Your message is saved. Our team will contact you using the details you provided.",
        previewLink: null,
      };
    }
    throw new Response("Not found", { status: 404 });
  } catch (e) {
    return data(
      {
        message:
          e instanceof Response
            ? await e.text()
            : e instanceof z.ZodError
              ? e.issues.map((i) => i.message).join(" · ")
              : "Unable to save your request. Try again.",
        previewLink: null,
      },
      { status: e instanceof Response ? e.status : 400 },
    );
  }
}
export default function Services() {
  const d = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <div className="page narrow">
      <h1>
        {d.path === "unsubscribe"
          ? "EMAIL PREFERENCES."
          : "CONFIRM SUBSCRIPTION."}
      </h1>
      {result ? (
        <p role="status">{result.message}</p>
      ) : (
        <Form method="post" className="admin-form">
          <input type="hidden" name="token" value={d.token} />
          <p>
            {d.path === "unsubscribe"
              ? "Stop receiving promotional emails from Games Factory Pakistan."
              : "Confirm that you want to receive product news and offers from Games Factory Pakistan."}
          </p>
          <button className="button">
            {d.path === "unsubscribe" ? "Unsubscribe" : "Confirm subscription"}
          </button>
        </Form>
      )}
      <Link className="text-link" to="/">
        Back to store ↗
      </Link>
    </div>
  );
}
