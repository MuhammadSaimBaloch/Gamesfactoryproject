import type { ProductCardData } from "../../lib/server/catalog";
import { ProductShowcase } from "./product-showcase";
export function Showcase({
  products,
  title,
}: {
  products: ProductCardData[];
  title: string;
  subtitle?: string;
}) {
  return (
    <ProductShowcase products={products} title={title} kind="controllers" />
  );
}
