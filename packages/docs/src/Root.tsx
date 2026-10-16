import type { ReactNode } from "react";

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Page-specific tags (title, description, canonical, og:title/description/url)
            are rendered per page by PageHead / PageMeta and hoisted into <head> by React. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="FUNSTACK UI" />
        <meta name="twitter:card" content="summary" />
      </head>
      <body>{children}</body>
    </html>
  );
}
