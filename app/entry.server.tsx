import { renderToReadableStream } from "react-dom/server";
import {
  ServerRouter,
  type EntryContext,
  type RouterContextProvider,
} from "react-router";
import { nonceContext } from "./lib/context";
import { isbot } from "isbot";
export default async function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext,
  loadContext: RouterContextProvider,
) {
  const nonce = loadContext.get(nonceContext);
  const body = await renderToReadableStream(
    <ServerRouter context={context} url={request.url} nonce={nonce} />,
    {
      nonce,
      signal: request.signal,
      onError() {
        status = 500;
      },
    },
  );
  if (isbot(request.headers.get("user-agent") || "")) await body.allReady;
  headers.set("Content-Type", "text/html");
  return new Response(body, { status, headers });
}
