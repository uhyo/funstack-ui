import { Drawer } from "@funstack/ui/drawer";

const pages = [
  ["Dialog", "/components/dialog"],
  ["AlertDialog", "/components/alert-dialog"],
  ["Drawer", "/components/drawer"],
  ["Popover", "/components/popover"],
  ["Menu", "/components/menu"],
  ["Tooltip", "/components/tooltip"],
  ["HoverCard", "/components/hover-card"],
  ["Toast", "/components/toast"],
] as const;

// A side navigation drawer, written as a Server Component: the Root has no open-state props,
// so the Drawer is JS-free. The Trigger and the Close are Invoker Commands, the content and
// `data-side` are in the server HTML, CSS slides it in and out, and Escape closes it before
// hydration. After hydration a drag toward its edge closes it too (no callback exists in this
// mode). `inline-start` follows the page's direction: on the left here, on the right in a
// right-to-left page. The Popup itself scrolls: a side drawer's swipe is horizontal.
export function DrawerNavigation() {
  return (
    <div className="demo-row">
      <Drawer.Root>
        <Drawer.Trigger className="demo-button">Menu</Drawer.Trigger>
        <Drawer.Popup className="demo-drawer" side="inline-start">
          <Drawer.Title>Overlays</Drawer.Title>
          <nav aria-label="Overlay components">
            <ul className="demo-drawer-nav">
              {pages.map(([label, href]) => (
                <li key={href}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <Drawer.Close className="demo-button">Close</Drawer.Close>
        </Drawer.Popup>
      </Drawer.Root>
    </div>
  );
}
