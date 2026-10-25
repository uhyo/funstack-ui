import { SITE_URL } from "../site.js";

/** The Markdown edition's file of a site path, relative to the site root (`/` is `index.md`). */
export function markdownFileOf(sitePath: string): string {
  return sitePath === "/" ? "index.md" : `${sitePath.slice(1)}.md`;
}

/** The path of `to` relative to the directory of `from`; both are relative to the site root. */
function relativePath(from: string, to: string): string {
  const fromDirs = from.split("/").slice(0, -1);
  const toParts = to.split("/");
  let common = 0;
  while (common < fromDirs.length && fromDirs[common] === toParts[common]) common++;
  return [...fromDirs.slice(common).map(() => ".."), ...toParts.slice(common)].join("/");
}

/**
 * Maps a link of the page at `fromPath`. Links to other pages point to their Markdown, either as
 * a relative path (`relative`) or an absolute URL; links to other files of the site become
 * absolute URLs, so they also work from the copy in the npm package.
 */
export function linkResolver(fromPath: string, pagePaths: ReadonlySet<string>, relative: boolean) {
  const fromFile = markdownFileOf(fromPath);
  return (href: string): string => {
    if (href.startsWith("#")) {
      return relative ? href : `${new URL(fromFile, SITE_URL).href}${href}`;
    }
    if (!href.startsWith("/") || href.startsWith("//")) return href;
    const hashIndex = href.indexOf("#");
    const fragment = hashIndex === -1 ? "" : href.slice(hashIndex);
    const targetPath = (hashIndex === -1 ? href : href.slice(0, hashIndex)).split("?")[0]!;
    if (!pagePaths.has(targetPath)) return new URL(href, SITE_URL).href;
    const targetFile = markdownFileOf(targetPath);
    if (!relative) return `${new URL(targetFile, SITE_URL).href}${fragment}`;
    return `${relativePath(fromFile, targetFile)}${fragment}`;
  };
}
