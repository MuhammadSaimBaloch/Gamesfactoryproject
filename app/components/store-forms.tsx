import { Link, useFetcher } from "react-router";
export function InquiryForm({
  enabled = true,
  product,
  message = "",
}: {
  enabled?: boolean;
  message?: string;
  product?: { id: string; variantId: string; quantity: number; terms: string };
}) {
  const f = useFetcher<{ message: string }>();
  return (
    <f.Form
      method="post"
      action={`/services/${product ? "preorder" : "contact"}`}
      className="admin-form"
    >
      <h2>{product ? "REQUEST A PRE-ORDER." : "SEND A MESSAGE."}</h2>
      {product && (
        <>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="variantId" value={product.variantId} />
          <input type="hidden" name="quantity" value={product.quantity} />
          <p className="preserve">{product.terms}</p>
          <p>
            This is a request. Staff will confirm availability and payment;
            submitting does not reserve stock.
          </p>
        </>
      )}
      <div className="form-grid">
        <label>
          Name
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" maxLength={30} autoComplete="tel" />
        </label>
        <label className="wide">
          {product ? "Your note" : "Message"}
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={4000}
            defaultValue={message}
          />
        </label>
      </div>
      <label className="form-trap" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="check">
        <input name="consent" type="checkbox" required />
        {product
          ? "I accept the displayed pre-order terms and agree to be contacted about this request."
          : "I agree to be contacted about this inquiry."}{" "}
        <Link to="/privacy">Privacy policy</Link>
      </label>
      <button className="button" disabled={!enabled || f.state !== "idle"}>
        {f.state !== "idle"
          ? "Submitting…"
          : product
            ? "Request pre-order"
            : "Send message"}
      </button>
      {!enabled && (
        <p>Online requests will open soon. Please contact a branch.</p>
      )}
      {f.data && <p role="status">{f.data.message}</p>}
    </f.Form>
  );
}
