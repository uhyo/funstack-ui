// Shared by the library's shipped functional stylesheets (conventions 12). No "use client"
// directive: constants only (conventions 7.1).

/**
 * The React stylesheet precedence bucket of the library's functional CSS. Fizz writes every
 * same-precedence `<style>` of one server flush as a single element with the texts concatenated,
 * which would match none of the per-href hashes in `STYLE_SHA256`: at most one shipped stylesheet
 * in this bucket may render during server rendering (today the tooltip skip-delay rule; the menu
 * point rules are client-only). A second one needs a precedence of its own (guard row in
 * `csp/csp.test.tsx`).
 */
export const FSUI_PRECEDENCE = "fsui";
