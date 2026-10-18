import { JsonLd } from "./components/json-ld";
import { environmentContext, nonceContext } from "./lib/context";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useNavigation,
  useRouteError,
  useLocation,
  isRouteErrorResponse,
  Link,
  type LoaderFunctionArgs,
} from "react-router";
import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import { Header } from "./components/layout/header";
import { BagDrawer } from "./components/cart/bag";
import { useCart } from "./lib/cart";
import { siteData } from "./lib/server/catalog";
import "./styles/app.css";
export async function loader({ context }: LoaderFunctionArgs) {
  const data = await siteData(context.get(environmentContext));
  return {
    ...data,
    siteUrl: context.get(environmentContext).SITE_URL,
    nonce: context.get(nonceContext),
  };
}
export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <Meta />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <Links nonce={data?.nonce} />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={data?.nonce} />
        <Scripts nonce={data?.nonce} />
      </body>
    </html>
  );
}
export default function App() {
  const path = useLocation().pathname;
  const ownerConsole = path === "/admin" || path.startsWith("/admin/");
  const navigation = useNavigation();
  const data = useLoaderData<typeof loader>();
  const notice = useCart((s) => s.notice);
  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {ownerConsole ? (
        <header className="owner-topbar">
          <Link to="/admin">
            <img src="/brand/logo.svg" alt="Games Factory Pakistan" />
            <span>Owner console</span>
          </Link>
          <Link to="/">Visit storefront ↗</Link>
        </header>
      ) : (
        <Header
          navigation={data.navigation}
          announcement={data.settings.announcement}
        />
      )}
      <main id="main">
        {navigation.state !== "idle" && (
          <div className="route-loading" role="status">
            Loading page…
          </div>
        )}
        <Outlet />
      </main>
      {!ownerConsole && (
        <>
          <JsonLd
            value={{
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Games Factory Pakistan",
              url: data.siteUrl,
              logo: `${data.siteUrl.replace(/\/$/, "")}/brand/logo.svg`,
              location: data.branches.map((b) => ({
                "@type": "Store",
                name: `Games Factory Pakistan — ${b.name}`,
                address: {
                  "@type": "PostalAddress",
                  addressLocality: b.city,
                  addressRegion: "Punjab",
                  addressCountry: "PK",
                  ...(b.address ? { streetAddress: b.address } : {}),
                },
              })),
            }}
          />
          <footer>
            <div className="footer-top">
              <div>
                <Link className="footer-brand" to="/">
                  <img
                    src="/brand/logo.svg"
                    alt="Games Factory Pakistan"
                    width="980"
                    height="240"
                    loading="lazy"
                  />
                </Link>
                <p>For the love of the game.</p>
              </div>
              <div>
                <h3>Explore</h3>
                {[
                  ["Shop all", "/shop"],
                  ["Controllers", "/controllers"],
                  ["Games", "/games"],
                  ["Consoles", "/category/consoles"],
                ].map(([n, l]) => (
                  <Link to={l} key={l}>
                    {n}
                  </Link>
                ))}
              </div>
              <div>
                <h3>Here to help</h3>
                {[
                  ["Our story", "/about"],
                  ["Find a branch", "/branches"],
                  ["Contact", "/contact"],
                  ["FAQs", "/faq"],
                  ["Payment information", "/policies/payment"],
                  ["Warranty", "/policies/warranty"],
                ].map(([n, l]) => (
                  <Link to={l} key={l}>
                    {n}
                  </Link>
                ))}
              </div>
              <div>
                <h3>Visit us in Multan</h3>
                {data.branches.map((b) => (
                  <Link to="/branches" key={b.id}>
                    {b.name} ↗
                  </Link>
                ))}
                <p>
                  Availability and order details
                  <br />
                  confirmed by our team.
                </p>
              </div>
            </div>
            <div className="footer-bottom">
              <span>© {new Date().getFullYear()} Games Factory Pakistan</span>
              <div>
                <Link to="/policies/shipping">Shipping</Link>
                <Link to="/policies/returns">Returns</Link>
                <Link to="/privacy">Privacy</Link>
              </div>
              <span>BUILT FOR PLAY.</span>
            </div>
          </footer>
          <BagDrawer />
          <span className="sr-only" role="status">
            {notice}
          </span>
        </>
      )}
    </MotionConfig>
  );
}
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="empty page">
      <span className="eyebrow">GAMES FACTORY PAKISTAN</span>
      <h1>
        {isRouteErrorResponse(error) ? error.status : "Something went wrong"}
      </h1>
      <p>
        {isRouteErrorResponse(error)
          ? typeof error.data === "string"
            ? error.data
            : "This page is unavailable."
          : "Please try again. Your bag is saved in this browser."}
      </p>
      <Link className="button" to="/">
        Back to home
      </Link>
    </div>
  );
}
