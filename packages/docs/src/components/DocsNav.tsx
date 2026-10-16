"use client";

import { useLocation } from "@funstack/router";
import { docsNavSections, type NavItem } from "../navigation.js";

function DocsNavLink({
  item,
  currentPath,
  onNavigate,
}: {
  item: NavItem;
  currentPath: string;
  onNavigate?: () => void;
}) {
  if (item.external) {
    return (
      <li>
        <a
          href={item.path}
          className="docs-nav-link"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
        >
          {item.label} <span aria-hidden="true">↗</span>
        </a>
      </li>
    );
  }
  const isActive = currentPath === item.path;
  return (
    <li>
      <a
        href={item.path}
        className={`docs-nav-link ${isActive ? "active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        onClick={onNavigate}
      >
        {item.label}
        {item.badge && <span className="nav-badge">{item.badge}</span>}
      </a>
    </li>
  );
}

// Lists all documentation pages grouped by section, highlighting the current page.
export function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname: currentPath } = useLocation();

  return (
    <>
      {docsNavSections.map((section) => (
        <div key={section.label} className="docs-nav-section">
          <p className="docs-nav-section-label">{section.label}</p>
          <ul className="docs-nav-list">
            {section.items.map((item) => (
              <DocsNavLink
                key={item.path}
                item={item}
                currentPath={currentPath}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
