export function seo(title: string, description: string, url?: string) {
  return [
    { title: `${title} | Games Factory Pakistan` },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    ...(url ? [{ tagName: "link", rel: "canonical", href: url }] : []),
  ];
}
