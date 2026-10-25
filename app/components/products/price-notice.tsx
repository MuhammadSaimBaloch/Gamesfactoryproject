import { useState } from "react";
import { priceNoticeText } from "../../lib/product-presentation";
export function PriceNotice() {
  const [paused, setPaused] = useState(false);
  return (
    <aside
      className={`price-notice ${paused ? "is-paused" : ""}`}
      aria-label="Current price notice"
    >
      <p className="sr-only">{priceNoticeText}</p>
      <div className="price-notice-window" aria-hidden="true">
        <div className="price-notice-track">
          {[0, 1].map((n) => (
            <span key={n}>{priceNoticeText}</span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused(!paused)}
        aria-label={paused ? "Play price notice" : "Pause price notice"}
      >
        {paused ? "Play" : "Pause"}
      </button>
    </aside>
  );
}
