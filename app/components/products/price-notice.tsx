import { priceNoticeText } from "../../lib/product-presentation";
export function PriceNotice() {
  return (
    <aside className="price-notice" aria-label="Current price notice">
      <p className="sr-only">{priceNoticeText}</p>
      <div className="price-notice-window" aria-hidden="true">
        <div className="price-notice-track">
          {[0, 1].map((n) => (
            <span key={n}>{priceNoticeText}</span>
          ))}
        </div>
      </div>
    </aside>
  );
}
