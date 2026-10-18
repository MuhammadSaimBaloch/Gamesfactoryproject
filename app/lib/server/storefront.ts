import { z } from "zod";
import type { Env } from "../../types/env";
export const emailInput = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());
export const detailsInput = z
  .object({
    productId: z.string().min(1).max(80),
    priceOnRequest: z.coerce.number().int().min(0).max(1).default(0),
    generation: z.enum([
      "",
      "PS4",
      "PS5",
      "Xbox One",
      "Xbox Series",
      "Switch",
      "Switch 2",
      "PC",
    ]),
    compatibility: z.string().trim().max(2000),
    region: z.string().trim().max(120),
    edition: z.string().trim().max(120),
    boxContents: z.string().trim().max(3000),
    warranty: z.string().trim().max(3000),
    denomination: z.string().trim().max(120),
    redemption: z.string().trim().max(3000),
    deliveryTerms: z.string().trim().max(3000),
    saleMode: z.enum(["stock", "preorder"]),
    releaseDate: z.union([z.literal(""), z.iso.date()]),
    depositTerms: z.string().trim().max(3000),
  })
  .superRefine((v, c) => {
    if (v.saleMode === "preorder" && !v.depositTerms)
      c.addIssue({
        code: "custom",
        path: ["depositTerms"],
        message:
          "Explain the deposit, cancellation and fulfillment terms before enabling pre-orders.",
      });
  });
export type ProductDetails = z.infer<typeof detailsInput>;
export async function getDetails(env: Env, id: string) {
  return env.DB.prepare(
    "SELECT product_id AS productId,price_on_request AS priceOnRequest,generation,compatibility,region,edition,box_contents AS boxContents,warranty,denomination,redemption,delivery_terms AS deliveryTerms,sale_mode AS saleMode,release_date AS releaseDate,deposit_terms AS depositTerms FROM product_details WHERE product_id=?",
  )
    .bind(id)
    .first<ProductDetails>();
}
export interface Promotion {
  id: string;
  title: string;
  body: string;
  imageKey: string;
  href: string;
  cta: string;
  enabled: number;
  sort: number;
  startsAt: string;
  endsAt: string;
}
export async function promotions(env: Env, all = false) {
  const result = await env.DB.prepare(
    `SELECT id,title,body,image_key AS imageKey,href,cta,enabled,sort_order AS sort,starts_at AS startsAt,ends_at AS endsAt FROM promotions ${all ? "" : "WHERE enabled=1 AND (starts_at='' OR starts_at<=?) AND (ends_at='' OR ends_at>=?)"} ORDER BY sort_order`,
  )
    .bind(...(all ? [] : [new Date().toISOString(), new Date().toISOString()]))
    .all<Promotion>();
  return result.results;
}
export interface Inquiry {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  status: string;
  staff_notes: string;
  created_at: string;
}
export const inquiryInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailInput,
  phone: z.string().trim().max(30),
  message: z.string().trim().min(10).max(4000),
  consent: z.literal("on"),
  website: z.string().max(0),
});
export function localHref(value: string) {
  return /^\/(?!\/)[a-zA-Z0-9/?=&%_.#-]*$/.test(value) && !value.includes("\\");
}
