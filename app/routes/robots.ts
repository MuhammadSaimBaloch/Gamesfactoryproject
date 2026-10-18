import { environmentContext } from "../lib/context";
import type { LoaderFunctionArgs } from "react-router";
export function loader({ context }: LoaderFunctionArgs) {
  const env = context.get(environmentContext);
  return new Response(
    env.ENVIRONMENT !== "production"
      ? "User-agent: *\nDisallow: /"
      : `User-agent: *\nDisallow: /admin\nDisallow: /api\nDisallow: /checkout\nDisallow: /cart\nDisallow: /account\nDisallow: /services\nSitemap: ${env.SITE_URL}/sitemap.xml`,
    { headers: { "Content-Type": "text/plain" } },
  );
}
