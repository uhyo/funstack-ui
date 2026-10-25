export const GITHUB_URL = "https://github.com/uhyo/funstack-ui";
export const ISSUES_URL = `${GITHUB_URL}/issues`;

export type NavItem = {
  path: string;
  label: string;
  external?: boolean;
  /** Shown next to the label, e.g. "coming soon". */
  badge?: string;
  /** A sub-heading inside the section; consecutive items with the same group share it. */
  group?: string;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const conceptNavItems: NavItem[] = [
  { path: "/concepts/action-props", label: "Action props" },
  { path: "/concepts/pending-and-optimistic", label: "Pending & optimistic state" },
  { path: "/concepts/transitions", label: "Transitions & ViewTransition" },
  { path: "/concepts/suspense", label: "Suspense" },
  { path: "/concepts/browser-owned-state", label: "Browser-owned state" },
  { path: "/concepts/server-components", label: "Server Components" },
];

export const guideNavItems: NavItem[] = [
  { path: "/concepts/experimental", label: "Experimental features" },
  { path: "/concepts/content-security-policy", label: "Content Security Policy" },
  { path: "/guides/ai-agents", label: "Using with AI agents" },
];

// Grouped by kind, so a reader looking for "a form control" or "an overlay" scans a few names.
export const componentNavItems: NavItem[] = [
  { path: "/components/button", label: "Button", group: "Buttons" },
  { path: "/components/toggle", label: "Toggle", group: "Buttons" },
  { path: "/components/toggle-group", label: "ToggleGroup", group: "Buttons" },
  { path: "/components/toolbar", label: "Toolbar", group: "Buttons" },
  { path: "/components/tabs", label: "Tabs", group: "Disclosure" },
  { path: "/components/accordion", label: "Accordion", group: "Disclosure" },
  { path: "/components/tooltip", label: "Tooltip", group: "Overlays" },
  { path: "/components/popover", label: "Popover", group: "Overlays" },
  { path: "/components/dialog", label: "Dialog", group: "Overlays" },
  { path: "/components/menu", label: "Menu", group: "Overlays" },
  { path: "/components/context-menu", label: "Context menu (Menu)", group: "Overlays" },
  { path: "/components/toast", label: "Toast", group: "Overlays" },
  { path: "/components/field", label: "Field and Form", group: "Forms" },
  { path: "/components/checkbox", label: "Checkbox", group: "Forms" },
  { path: "/components/checkbox-group", label: "CheckboxGroup", group: "Forms" },
  { path: "/components/radio-group", label: "RadioGroup", group: "Forms" },
  { path: "/components/switch", label: "Switch", group: "Forms" },
  { path: "/components/select", label: "Select", group: "Forms" },
  { path: "/components/combobox", label: "Combobox", group: "Forms" },
  { path: "/components/slider", label: "Slider", group: "Forms" },
  { path: "/components/number-field", label: "NumberField", group: "Forms" },
  { path: "/components/progress", label: "Progress", group: "Output" },
  { path: "/components/meter", label: "Meter", group: "Output" },
];

// Site-wide documentation navigation, rendered by the sidebar and the mobile menu.
export const docsNavSections: NavSection[] = [
  {
    label: "Introduction",
    items: [
      { path: "/why", label: "Why FUNSTACK UI" },
      { path: "/", label: "Overview" },
      { path: "/getting-started", label: "Getting started" },
    ],
  },
  { label: "Concepts", items: conceptNavItems },
  { label: "Guides", items: guideNavItems },
  { label: "Components", items: componentNavItems },
  {
    label: "Resources",
    items: [
      { path: "/roadmap", label: "Roadmap & changelog" },
      { path: GITHUB_URL, label: "GitHub", external: true },
    ],
  },
];
