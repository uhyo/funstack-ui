// No "use client": this file is a Server Component. No Item has an open-state prop, so every
// panel runs in JS-free mode: the browser toggles it through `popovertarget`, keeps one open at a
// time, closes it on Escape and a click outside, and the links are in the server HTML. After
// hydration the library adds two closes: focus leaving an Item, and a followed link.
//
// The links point at sections of this page, so following one keeps you here.
import { NavigationMenu } from "@funstack/ui/navigation-menu";

const sections = {
  Reference: [
    { href: "#anatomy", label: "Anatomy" },
    { href: "#props", label: "Props" },
    { href: "#data-attributes", label: "Data attributes" },
  ],
  Behaviour: [
    { href: "#how-it-works", label: "How it works" },
    { href: "#keyboard-and-aria", label: "Keyboard and ARIA" },
    { href: "#suspense", label: "Suspense" },
  ],
};

export function NavigationMenuSite() {
  return (
    <NavigationMenu.Root aria-label="This page" className="demo-nav">
      <NavigationMenu.List className="demo-nav-list">
        {Object.entries(sections).map(([title, links]) => (
          <NavigationMenu.Item key={title}>
            <NavigationMenu.Trigger className="demo-nav-trigger">{title}</NavigationMenu.Trigger>
            <NavigationMenu.Popup className="demo-nav-panel">
              <ul className="demo-nav-links">
                {links.map((link) => (
                  <li key={link.href}>
                    <NavigationMenu.Link href={link.href}>{link.label}</NavigationMenu.Link>
                  </li>
                ))}
              </ul>
            </NavigationMenu.Popup>
          </NavigationMenu.Item>
        ))}
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#recipes" className="demo-nav-trigger">
            Recipes
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
