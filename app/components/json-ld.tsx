import { useRouteLoaderData } from "react-router";
import type { loader } from "../root";
export function JsonLd({ value }: { value: Record<string, unknown> }) {
  const root = useRouteLoaderData<typeof loader>("root");
  return (
    <script
      type="application/ld+json"
      nonce={root?.nonce}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(value)
          .replaceAll("<", "\\u003c")
          .replaceAll(">", "\\u003e")
          .replaceAll("&", "\\u0026"),
      }}
    />
  );
}
