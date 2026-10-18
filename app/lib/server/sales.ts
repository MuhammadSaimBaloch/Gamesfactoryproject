import { sql } from "drizzle-orm";
import { variants } from "../../../db/schema";
import type { Env } from "../../types/env";
export type Sale = {
  id: string;
  title: string;
  mode: "percent" | "fixed";
  value: number;
  enabled: number;
  starts_at: string;
  ends_at: string;
};
export const effectivePrice = sql<number>`coalesce((SELECT min(max(0,cast(round(${variants.price} - CASE s.mode WHEN 'percent' THEN ${variants.price}*s.value/100.0 ELSE s.value END) as integer))) FROM sales s JOIN sale_variants sv ON sv.sale_id=s.id WHERE sv.variant_id=${variants.id} AND s.enabled=1 AND (s.starts_at='' OR s.starts_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')) AND (s.ends_at='' OR s.ends_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))),${variants.price})`;
export async function salePrices(env: Env, ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = (
    await env.DB.prepare(
      `SELECT v.id,min(max(0,cast(round(v.price_pkr - CASE s.mode WHEN 'percent' THEN v.price_pkr*s.value/100.0 ELSE s.value END) as integer))) AS price FROM product_variants v JOIN sale_variants sv ON sv.variant_id=v.id JOIN sales s ON s.id=sv.sale_id WHERE v.id IN (${ids.map(() => "?").join(",")}) AND s.enabled=1 AND (s.starts_at='' OR s.starts_at<=?) AND (s.ends_at='' OR s.ends_at>?) GROUP BY v.id`,
    )
      .bind(...ids, new Date().toISOString(), new Date().toISOString())
      .all<{ id: string; price: number }>()
  ).results;
  return new Map(rows.map((r) => [r.id, r.price]));
}
