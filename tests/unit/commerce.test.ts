import { describe, it, expect } from "vitest";
import {
  checkoutSchema,
  phone,
  cartSchema,
  canTransition,
} from "../../app/lib/validation/commerce";
import {
  orderNumber,
  orderMessage,
  whatsappHandoff,
  type Snapshot,
} from "../../app/lib/order-message";
import { parseCsv, exportCsv } from "../../app/lib/csv";
const customer = {
  name: "Test Customer",
  phone: "923001234567",
  email: "",
  city: "Multan",
  province: "Punjab",
  address: "Test address",
  postalCode: "",
  notes: "",
};
const input = {
  items: [{ variantId: "a", quantity: 2 }],
  customer,
  fulfillment: "delivery",
  idempotencyKey: crypto.randomUUID(),
  token: "token",
  consent: true,
};
const snapshot: Snapshot = {
  number: "GFP-TEST",
  customer,
  fulfillment: "delivery",
  branchName: "",
  subtotal: 200,
  shipping: 50,
  total: 250,
  items: [
    {
      name: "Controller",
      variant: "White",
      sku: "TEST",
      price: 100,
      quantity: 2,
      total: 200,
    },
  ],
};
describe("checkout validation", () => {
  it("normalizes Pakistani mobile numbers", () => {
    for (const value of ["0300 1234567", "+92 300 1234567", "00923001234567"])
      expect(phone.parse(value)).toBe("923001234567");
  });
  it("rejects invalid phone numbers", () =>
    expect(phone.safeParse("123").success).toBe(false));
  it("requires delivery address", () =>
    expect(
      checkoutSchema.safeParse({
        ...input,
        customer: { ...customer, address: "" },
      }).success,
    ).toBe(false));
  it("allows pickup without home address", () =>
    expect(
      checkoutSchema.safeParse({
        ...input,
        fulfillment: "pickup",
        branchId: "branch",
        customer: { ...customer, address: "", city: "", province: "" },
      }).success,
    ).toBe(true));
  it("requires pickup branch", () =>
    expect(
      checkoutSchema.safeParse({ ...input, fulfillment: "pickup" }).success,
    ).toBe(false));
  it("rejects empty, duplicate and invalid quantities", () => {
    for (const cart of [
      [],
      [{ variantId: "a", quantity: 0 }],
      [{ variantId: "a", quantity: 1.2 }],
      [{ variantId: "a", quantity: 21 }],
      [
        { variantId: "a", quantity: 1 },
        { variantId: "a", quantity: 1 },
      ],
    ])
      expect(cartSchema.safeParse(cart).success).toBe(false);
  });
  it("rejects multiline note spoofing", () =>
    expect(
      checkoutSchema.safeParse({
        ...input,
        customer: { ...customer, notes: "Hello\nTOTAL: 0" },
      }).success,
    ).toBe(false));
  it("ignores client price and totals", () =>
    expect(
      checkoutSchema.parse({
        ...input,
        total: 0,
        items: [{ variantId: "a", quantity: 1, price: 1 }],
      }).items[0],
    ).toEqual({ variantId: "a", quantity: 1 }));
  it("requires affirmative disclosure consent", () =>
    expect(checkoutSchema.safeParse({ ...input, consent: false }).success).toBe(
      false,
    ));
});
describe("saved order messaging", () => {
  it("includes complete customer, item and total information", () => {
    const message = orderMessage(snapshot);
    for (const value of [
      "GFP-TEST",
      "Test Customer",
      "923001234567",
      "White",
      "TEST",
      "Quantity: 2",
      "200",
      "250",
      "Punjab",
      "Test address",
    ])
      expect(message).toContain(value);
    expect(message).not.toContain("Email:");
  });
  it("encodes the full message", () => {
    const result = whatsappHandoff("923001234567", snapshot);
    expect(new URL(result.url).searchParams.get("text")).toBe(result.message);
  });
  it("rejects unverified-format destination", () =>
    expect(() => whatsappHandoff("+92 300", snapshot)).toThrow());
  it("preserves every line in long-message fallback", () => {
    const result = whatsappHandoff("923001234567", {
      ...snapshot,
      items: Array.from({ length: 100 }, (_, i) => ({
        ...snapshot.items[0],
        name: `Item ${i}`,
      })),
    });
    expect(result.copyRequired).toBe(true);
    expect(result.message).toContain("Item 99");
    expect(result.url).toBe("https://wa.me/923001234567");
  });
  it("uses Pakistan date and unique random identifiers", () => {
    expect(orderNumber(new Date("2026-10-17T20:00:00Z"))).toMatch(
      /^GFP-20261018-/,
    );
    expect(
      new Set(Array.from({ length: 1000 }, () => orderNumber())).size,
    ).toBe(1000);
  });
  it("does not skip verification or reopen terminal states", () => {
    expect(canTransition("AWAITING_WHATSAPP_MESSAGE", "PAID")).toBe(false);
    expect(canTransition("CONTACTED", "CONFIRMED")).toBe(true);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });
});
describe("CSV", () => {
  it("handles commas and quoted newlines", () =>
    expect(parseCsv('name,slug\r\n"A, B",ab\r\n"Line\nTwo",two')).toEqual([
      { name: "A, B", slug: "ab" },
      { name: "Line\nTwo", slug: "two" },
    ]));
  it("rejects malformed imports", () => {
    expect(() => parseCsv("a,a\n1,2")).toThrow();
    expect(() => parseCsv("a,b\n1")).toThrow();
  });
  it("neutralizes spreadsheet formulas on export", () =>
    expect(exportCsv([{ name: "=cmd()", price: 5 }])).toContain("'=cmd()"));
});
