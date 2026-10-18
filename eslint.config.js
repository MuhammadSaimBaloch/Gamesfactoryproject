import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "build/**",
      ".react-router/**",
      "node_modules/**",
      ".wrangler/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
    ],
  },
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
);
