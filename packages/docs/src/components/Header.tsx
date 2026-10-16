"use client";

import { useLocation } from "@funstack/router";
import { useState } from "react";
import { GITHUB_URL } from "../navigation.js";
import { DocsNav } from "./DocsNav.js";

const navItems = [
  { path: "/", match: "/", label: "Home" },
  { path: "/getting-started", match: "/getting-started", label: "Getting started" },
  { path: "/concepts/action-props", match: "/concepts", label: "Concepts" },
  { path: "/components/toggle", match: "/components", label: "Components" },
  { path: "/roadmap", match: "/roadmap", label: "Roadmap" },
];

export function Header() {
  const { pathname: currentPath } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (match: string) =>
    match === "/" ? currentPath === "/" || currentPath === "" : currentPath.startsWith(match);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="header">
      <div className="header-content">
        <p className="logo">
          <a href="/">
            FUNSTACK <span className="logo-accent">UI</span>
          </a>
        </p>
        <nav className="nav" aria-label="Site">
          {navItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              className={`nav-link ${isActive(item.match) ? "active" : ""}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a href={GITHUB_URL} className="github-link" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <button
          type="button"
          className="hamburger"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? "✕" : "☰"}
        </button>
      </div>
      {isMenuOpen && (
        <nav className="mobile-nav" aria-label="Documentation">
          <DocsNav onNavigate={closeMenu} />
        </nav>
      )}
    </header>
  );
}
