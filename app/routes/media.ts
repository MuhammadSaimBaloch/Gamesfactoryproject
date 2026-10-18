import { environmentContext } from "../lib/context";
import type { LoaderFunctionArgs } from "react-router";
import { imageUrl } from "../lib/image-url";
export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const key = params["*"] || "";
  if (/^catalogue\/[a-z0-9-]+\.(png|jpg|webp|avif)$/.test(key))
    return Response.redirect(
      new URL(
        imageUrl(
          key,
          Number(new URL(request.url).searchParams.get("w")) || 960,
        ),
        request.url,
      ).href,
      302,
    );
  if (!/^products\/[a-f0-9-]+\.(png|webp|avif)$/.test(key))
    throw new Response("Not found", { status: 404 });
  const bucket = context.get(environmentContext).MEDIA;
  const width = new URL(request.url).searchParams.get("w");
  let obj = ["480", "960"].includes(width || "")
    ? await bucket.get(key.replace(/\.[^.]+$/, `-${width}.webp`))
    : null;
  if (!obj) obj = await bucket.get(key);
  if (!obj) throw new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", obj.httpEtag);
  if (request.headers.get("If-None-Match") === obj.httpEtag)
    return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
}
