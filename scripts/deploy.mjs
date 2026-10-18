import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const target = process.argv[2];
if (!["staging", "production"].includes(target))
  throw Error("Choose staging or production");
const required = [
  "GFP_D1_ID",
  "GFP_D1_NAME",
  "GFP_R2_BUCKET",
  "GFP_SITE_URL",
  "GFP_ACCESS_ISSUER",
  "GFP_ACCESS_AUD",
  "GFP_ADMIN_EMAILS",
  "GFP_TURNSTILE_SITE_KEY",
];
for (const key of required)
  if (!process.env[key]) throw Error(`Missing ${key}. See DEPLOYMENT.md.`);
if (!/^[0-9a-f-]{36}$/.test(process.env.GFP_D1_ID))
  throw Error("Use the real D1 UUID returned by Cloudflare");
if (!process.env.GFP_SITE_URL.startsWith("https://"))
  throw Error("Deployment requires an HTTPS site URL");
const base = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
const config = {
  ...base,
  name: `games-factory-${target}`,
  d1_databases: [
    {
      binding: "DB",
      database_name: process.env.GFP_D1_NAME,
      database_id: process.env.GFP_D1_ID,
      migrations_dir: "db/migrations",
    },
  ],
  r2_buckets: [{ binding: "MEDIA", bucket_name: process.env.GFP_R2_BUCKET }],
  vars: {
    ENVIRONMENT: target,
    DEMO_MODE: "false",
    SITE_URL: process.env.GFP_SITE_URL,
    ACCESS_ISSUER: process.env.GFP_ACCESS_ISSUER,
    ACCESS_AUD: process.env.GFP_ACCESS_AUD,
    ADMIN_EMAILS: process.env.GFP_ADMIN_EMAILS,
    TURNSTILE_SITE_KEY: process.env.GFP_TURNSTILE_SITE_KEY,
  },
  workers_dev: target === "staging",
};
const path = `wrangler.${target}.json`;
await writeFile(path, JSON.stringify(config, null, 2));
const run = (file, args, env = {}) => {
  const result = spawnSync(process.execPath, [file, ...args], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status || 1);
};
if (process.argv.includes("--configure-only")) {
  console.log(
    `Prepared ${path}. Configure the Turnstile secret and Access policy, then deploy.`,
  );
  process.exit(0);
}
run("node_modules/wrangler/bin/wrangler.js", [
  "d1",
  "migrations",
  "apply",
  "DB",
  "--remote",
  "--config",
  path,
]);
run("scripts/optimize-images.mjs", []);
run("node_modules/@react-router/dev/bin.cjs", ["build"], { GFP_CONFIG: path });
run("node_modules/wrangler/bin/wrangler.js", [
  "deploy",
  "--config",
  "build/server/wrangler.json",
]);
