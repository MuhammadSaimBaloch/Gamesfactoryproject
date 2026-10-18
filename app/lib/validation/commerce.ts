import { z } from "zod";
const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (v) => !/[\r\n\x00-\x1f]/.test(v),
      "Use a single line without control characters",
    );
export const phone = z
  .string()
  .trim()
  .transform((v) =>
    v
      .replace(/[\s()+-]/g, "")
      .replace(/^0092/, "92")
      .replace(/^0/, "92"),
  )
  .pipe(
    z.string().regex(/^923\d{9}$/, "Enter a valid Pakistani mobile number"),
  );
export const cartSchema = z
  .array(
    z.object({
      variantId: z.string().min(1).max(80),
      quantity: z.number().int().min(1).max(20),
    }),
  )
  .min(1)
  .max(40)
  .refine(
    (v) => new Set(v.map((i) => i.variantId)).size === v.length,
    "Duplicate variants are not allowed",
  );
export const customerSchema = z.object({
  name: line(100).min(2),
  phone,
  email: z.union([z.email(), z.literal("")]).default(""),
  province: line(80).default(""),
  city: line(80).default(""),
  address: line(300).default(""),
  postalCode: line(12).default(""),
  notes: line(500).default(""),
});
export const checkoutSchema = z
  .object({
    items: cartSchema,
    customer: customerSchema,
    fulfillment: z.enum(["delivery", "pickup", "digital"]),
    branchId: z.string().max(80).optional(),
    idempotencyKey: z.uuid(),
    token: z.string().max(2048),
    consent: z.literal(true),
    acceptedTotal: z.number().int().nonnegative().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery")
      for (const field of ["province", "city", "address"] as const)
        if (!v.customer[field])
          ctx.addIssue({
            code: "custom",
            path: ["customer", field],
            message: "Required for delivery",
          });
    if (v.fulfillment === "pickup" && !v.branchId)
      ctx.addIssue({
        code: "custom",
        path: ["branchId"],
        message: "Choose a pickup branch",
      });
  });
export type Checkout = z.infer<typeof checkoutSchema>;
export const statusTransitions: Record<string, string[]> = {
  AWAITING_WHATSAPP_MESSAGE: ["CONTACTED", "CANCELLED"],
  CONTACTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PAYMENT_PENDING", "PAID", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "CANCELLED"],
  PAID: ["DISPATCHED", "COMPLETED", "CANCELLED"],
  DISPATCHED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};
export function canTransition(from: string, to: string) {
  return statusTransitions[from]?.includes(to) ?? false;
}
