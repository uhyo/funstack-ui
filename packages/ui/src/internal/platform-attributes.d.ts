// Platform attributes that `@types/react` 19.3 does not type yet (conventions 7.4). This file is
// the only place a `declare module` appears. Each entry names the upstream gap so it can be
// deleted when DefinitelyTyped catches up. Write these attributes lowercase in JSX: react-dom
// passes unknown lowercase attributes through verbatim on client and server.
import type {} from "react";

declare module "react" {
  interface HTMLAttributes<T> {
    /**
     * `focusgroup` (Chromium 150+): native roving focus. A behaviour token (`tablist`, `toolbar`,
     * ...) plus modifiers (`inline`, `block`, `wrap`, `nowrap`, `nomemory`).
     * Not in `@types/react` 19.3.0 (no DefinitelyTyped issue filed as of 2026-10-16).
     */
    focusgroup?: string | undefined;
  }
}
