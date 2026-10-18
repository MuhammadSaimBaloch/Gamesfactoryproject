import { BagContents } from "../components/cart/bag";
import { seo } from "../lib/seo";
export const meta = () =>
  seo("Your bag", "Review your selected games and gaming gear.");
export default function Cart() {
  return (
    <div className="page narrow">
      <span className="eyebrow">ONE STEP CLOSER TO PLAY</span>
      <h1>YOUR BAG.</h1>
      <BagContents />
    </div>
  );
}
