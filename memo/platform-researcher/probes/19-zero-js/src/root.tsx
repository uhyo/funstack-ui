import type { ReactNode } from "react";
export default function Root({ children }: { children: ReactNode }) {
  return (<html lang="en"><head><meta charSet="UTF-8" /></head><body>{children}</body></html>);
}
