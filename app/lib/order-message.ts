import type { Checkout } from "./validation/commerce";
import { money } from "./money";
export interface Snapshot {
  number: string;
  customer: Checkout["customer"];
  fulfillment: string;
  branchName: string;
  subtotal: number;
  shipping: number;
  total: number;
  items: {
    name: string;
    variant: string;
    sku: string;
    price: number;
    quantity: number;
    total: number;
  }[];
}
export function orderMessage(order: Snapshot) {
  const c = order.customer;
  return [
    "GAMES FACTORY PAKISTAN",
    "New Order Request",
    `Order Number: ${order.number}`,
    "",
    "CUSTOMER DETAILS",
    `Name: ${c.name}`,
    `Phone: ${c.phone}`,
    c.email && `Email: ${c.email}`,
    c.city && `City: ${c.city}`,
    c.province && `Province: ${c.province}`,
    c.address && `Address: ${c.address}`,
    c.postalCode && `Postal code: ${c.postalCode}`,
    "",
    "ORDER DETAILS",
    ...order.items.map(
      (i, n) =>
        `${n + 1}. ${i.name}\nVariant: ${i.variant}\nSKU: ${i.sku}\nQuantity: ${i.quantity}\nUnit Price: ${money(i.price)}\nLine Total: ${money(i.total)}\n`,
    ),
    `Subtotal: ${money(order.subtotal)}`,
    `Shipping: ${money(order.shipping)}`,
    `TOTAL: ${money(order.total)}`,
    `Fulfillment: ${order.fulfillment === "pickup" ? "Branch pickup" : order.fulfillment === "digital" ? "Digital delivery to customer account" : "Delivery"}`,
    order.branchName && `Selected Branch: ${order.branchName}`,
    c.notes && `Customer note (quoted): ${JSON.stringify(c.notes)}`,
    "",
    "Please confirm availability, order details, payment instructions, and fulfillment.",
    "This is an unconfirmed order request.",
  ]
    .filter((v) => v !== undefined && v !== null)
    .join("\n");
}
export function whatsappHandoff(number: string, snapshot: Snapshot) {
  if (!/^923\d{9}$/.test(number))
    throw Error("Store WhatsApp number is not configured");
  const message = orderMessage(snapshot);
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  return {
    message,
    url: url.length <= 7000 ? url : `https://wa.me/${number}`,
    copyRequired: url.length > 7000,
  };
}
export function orderNumber(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");
  return `GFP-${date}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
}
