import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [
    cloudflare({
      configPath: process.env.GFP_CONFIG || "wrangler.jsonc",
      viteEnvironment: { name: "ssr" },
    }),
    tailwindcss(),
    reactRouter(),
  ],
});
