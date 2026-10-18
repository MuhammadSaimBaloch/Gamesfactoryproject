import { beforeAll, afterEach, it, expect, vi } from "vitest";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { requireAdmin } from "../../app/lib/server/security";
import type { Env } from "../../app/types/env";
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwk: Awaited<ReturnType<typeof exportJWK>>;
const env = {
  ENVIRONMENT: "production",
  ACCESS_ISSUER: "https://team.cloudflareaccess.com",
  ACCESS_AUD: "store-admin",
  ADMIN_EMAILS: "owner@example.com",
} as Env;
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  jwk = await exportJWK(keys.publicKey);
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  jwk.use = "sig";
});
afterEach(() => vi.unstubAllGlobals());
it("requires an expiry on otherwise valid signed tokens", async () => {
  const jwt = await new SignJWT({ email: "owner@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(env.ACCESS_ISSUER!)
    .setAudience("store-admin")
    .setIssuedAt()
    .sign(keys.privateKey);
  await expect(requireAdmin(request(jwt), env)).rejects.toMatchObject({
    status: 403,
  });
});
async function token(
  email = "owner@example.com",
  aud = "store-admin",
  expiry = "5m",
) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(env.ACCESS_ISSUER!)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(keys.privateKey);
}
function request(jwt: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ keys: [jwk] })),
  );
  return new Request("https://store.example/admin", {
    headers: { "Cf-Access-Jwt-Assertion": jwt },
  });
}
it("verifies a signed, allowed Access identity", async () =>
  expect(await requireAdmin(request(await token()), env)).toBe(
    "owner@example.com",
  ));
it("rejects a signed but unlisted user", async () => {
  await expect(
    requireAdmin(request(await token("other@example.com")), env),
  ).rejects.toMatchObject({ status: 403 });
});
it("rejects incorrect audience and expired tokens", async () => {
  await expect(
    requireAdmin(request(await token("owner@example.com", "wrong")), env),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    requireAdmin(
      request(await token("owner@example.com", "store-admin", "-1m")),
      env,
    ),
  ).rejects.toMatchObject({ status: 403 });
});
it("never activates the local identity exception on a public production host", async () => {
  await expect(
    requireAdmin(new Request("https://store.example/admin"), {
      ...env,
      LOCAL_ADMIN_EMAIL: "owner@example.com",
    }),
  ).rejects.toMatchObject({ status: 403 });
});
