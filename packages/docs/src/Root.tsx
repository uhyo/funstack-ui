import type { ReactNode } from "react";
import { OG_IMAGE_URL, SITE_NAME } from "./site.js";

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Page-specific tags (title, description, canonical, og:title/description/url)
            are rendered per page by PageHead / PageMeta and hoisted into <head> by React. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={OG_IMAGE_URL} />
      </head>
      <body>{children}</body>
    </html>
  );
}
