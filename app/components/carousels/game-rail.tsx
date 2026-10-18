import type { ProductCardData } from "../../lib/server/catalog";
import { ProductShowcase } from "./product-showcase";
export function GameRail({
  products,
  title = "GAMES SECTION",
}: {
  products: ProductCardData[];
  title?: string;
}) {
  return <ProductShowcase products={products} title={title} kind="games" />;
}
