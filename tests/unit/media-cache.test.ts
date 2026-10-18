import { expect, it } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { loader } from "../../app/routes/media";

function args(path: string, etag?: string) {
  return {
    request: new Request(`https://store.example/media/${path}`, {
      headers: etag ? { "If-None-Match": etag } : {},
    }),
    params: { "*": path.split("?")[0] },
    context: {
      get: () => ({
        MEDIA: {
          get: async () => ({
            body: new Uint8Array([1, 2, 3]),
            httpEtag: '"photo-v1"',
            writeHttpMetadata: (headers: Headers) =>
              headers.set("Content-Type", "image/webp"),
          }),
        },
      }),
    },
  } as unknown as LoaderFunctionArgs;
}
it("revalidates unchanged uploaded images without transferring their body", async () => {
  const response = await loader(args("products/abc.webp", '"photo-v1"'));
  expect(response.status).toBe(304);
  expect(await response.text()).toBe("");
  expect(response.headers.get("ETag")).toBe('"photo-v1"');
  expect(response.headers.get("Cache-Control")).toContain("immutable");
});
it("returns image bytes when the browser has a different version", async () => {
  const response = await loader(args("products/abc.webp", '"old"'));
  expect(response.status).toBe(200);
  expect((await response.arrayBuffer()).byteLength).toBe(3);
});
it("legacy catalogue URLs resolve to an optimized image at the requested size", async () => {
  const response = await loader(
    args("catalogue/xbox-controller-shock-blue.png?w=480"),
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toMatch(
    /\/catalogue\/optimized\/.*-640\.webp$/,
  );
});
