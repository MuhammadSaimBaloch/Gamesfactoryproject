import { readFile, writeFile } from "node:fs/promises";

// One-time forward migration. Do not turn this into a recurring catalogue sync.
const content = JSON.parse(await readFile("db/catalogue-content.json", "utf8"));
const sources = JSON.parse(
  await readFile("db/inventory-image-sources.json", "utf8"),
);
const items = JSON.parse(await readFile("db/inventory-list.json", "utf8"));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const unresolved = {
  "dualsense-grand-theft-auto-vi-black":
    "Manufacturer release date is 19 November 2026. Keep unpublished until released or an owner-approved preorder workflow is configured.",
  "dualsense-grand-theft-auto-vi-white":
    "Manufacturer release date is 19 November 2026. Keep unpublished until released or an owner-approved preorder workflow is configured.",
  "xbox-series-s-512gb":
    "The store's Jailbreak options require verification. Standard Series S is all-digital; modification capability is not a manufacturer specification.",
  "nintendo-switch-2-mario-kart-8-bundle":
    "Confirm the actual included game and physical/digital format. Nintendo's official Switch 2 bundle contains Mario Kart World, not Mario Kart 8 Deluxe. An exact store-bundle photograph is still required.",
  "xbox-elite-wireless-controller-series-2-xbox-design-lab-custom-colours":
    "Confirm the actual custom shell, controls and accessory configuration, and supply its photograph. Design Lab has no single standard colourway.",
};
const statements = [
  "-- Catalogue photo and content completion, 25 October 2026.",
  "-- Preserve prices, inventory quantities, owner-written copy and owner-selected primary images.",
];
for (const row of content) {
  const product = `(SELECT id FROM products WHERE slug=${quote(row.slug)})`;
  const imported = items.find((item) => item.slug === row.slug);
  const importedDescription = imported
    ? `${imported.name}. Choose the available ${imported.options.length > 1 ? "condition and configuration" : "configuration"} below. Confirm supplied accessories and package contents with the store.`
    : row.previous.description;
  const expected = [
    ...new Set([
      row.previous.description,
      importedDescription,
      row.description,
    ]),
  ]
    .map(quote)
    .join(",");
  statements.push(
    `UPDATE products SET seo_description=CASE WHEN seo_description IN (${expected}) OR coalesce(seo_description,'')='' THEN ${quote(row.description.slice(0, 160))} ELSE seo_description END,description=${quote(row.description)} WHERE slug=${quote(row.slug)} AND description IN (${expected});`,
    `UPDATE product_details SET compatibility=${quote(row.compatibility)} WHERE product_id=${product} AND coalesce(compatibility,'') IN ('',${quote(row.previous.compatibility)},${quote(row.compatibility)});`,
    `UPDATE product_details SET edition=${quote(row.edition)} WHERE product_id=${product} AND coalesce(edition,'') IN ('',${quote(row.previous.edition)},${quote(row.edition)});`,
    // Existing values win on collisions, so owner-maintained configuration details survive.
    `UPDATE product_variants SET attributes_json=json_patch(${quote(JSON.stringify(row.specifications))},attributes_json) WHERE product_id=${product} AND json_valid(attributes_json);`,
  );
  for (const [index, picture] of sources
    .filter(
      (source) =>
        source.productSlug === row.slug && source.importBatch === "2026-10-25",
    )
    .entries()) {
    statements.push(
      `INSERT OR IGNORE INTO product_images(id,product_id,variant_id,r2_key,alt_text,display_order,is_primary,is_transparent_asset,is_showcase_asset,width,height) SELECT ${quote("catalogue-completion-" + row.slug + "-" + index)},${product},NULL,${quote(picture.key)},${quote(row.edition + " — " + row.slug + " product illustration")},0,CASE WHEN NOT EXISTS(SELECT 1 FROM product_images WHERE product_id=${product} AND is_primary=1) THEN 1 ELSE 0 END,1,1,${picture.width},${picture.height} WHERE ${product} IS NOT NULL;`,
    );
    // Publish only the imported draft that this change actually completes, not previously hidden products.
    if (!unresolved[row.slug])
      statements.push(
        `UPDATE products SET active=1 WHERE slug=${quote(row.slug)} AND active=0 AND description IN (${expected}) AND EXISTS(SELECT 1 FROM product_images WHERE product_id=products.id AND r2_key=${quote(picture.key)});`,
      );
  }
}
for (const slug of [
  "dualsense-grand-theft-auto-vi-black",
  "dualsense-grand-theft-auto-vi-white",
])
  statements.push(
    `UPDATE product_details SET release_date='2026-11-19' WHERE product_id=(SELECT id FROM products WHERE slug=${quote(slug)}) AND coalesce(release_date,'')='';`,
  );
await writeFile(
  "db/migrations/0013_catalogue_completion.sql",
  statements.join("\n") + "\n",
);
const review = items.map((item) => {
  const hasPicture = sources.some((source) => source.productSlug === item.slug);
  const reasons =
    unresolved[item.slug] ||
    (!hasPicture ? "Exact transparent product photograph pending." : "");
  return {
    slug: item.slug,
    name: item.name,
    status: reasons ? "Draft" : "Ready",
    options: item.options.length,
    reasons,
  };
});
await writeFile(
  "db/inventory-review.json",
  JSON.stringify(review, null, 2) + "\n",
);
console.log(
  `${content.length} content reviews, ${sources.filter((source) => source.importBatch === "2026-10-25").length} added images; ${review.filter((item) => item.status === "Draft").length} drafts remain.`,
);
