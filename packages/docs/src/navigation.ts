export const GITHUB_URL = "https://github.com/uhyo/funstack-ui";
export const ISSUES_URL = `${GITHUB_URL}/issues`;

export type NavItem = {
  path: string;
  label: string;
  external?: boolean;
  /** Shown next to the label, e.g. "coming soon". */
  badge?: string;
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
  { path: "/concepts/server-components", label: "Server Components" },
  { path: "/concepts/browser-owned-state", label: "Browser-owned state" },
  { path: "/concepts/experimental", label: "Experimental features" },
];

export const componentNavItems: NavItem[] = [
  { path: "/components/toggle", label: "Toggle" },
  { path: "/components/tabs", label: "Tabs" },
  { path: "/components/accordion", label: "Accordion" },
  { path: "/components/tooltip", label: "Tooltip" },
  { path: "/components/dialog", label: "Dialog" },
  { path: "/components/popover", label: "Popover" },
  { path: "/components/switch", label: "Switch" },
  { path: "/components/checkbox", label: "Checkbox" },
  { path: "/components/radio-group", label: "RadioGroup" },
  { path: "/components/checkbox-group", label: "CheckboxGroup" },
];

// Site-wide documentation navigation, rendered by the sidebar and the mobile menu.
export const docsNavSections: NavSection[] = [
  {
    label: "Introduction",
    items: [
      { path: "/", label: "Overview" },
      { path: "/getting-started", label: "Getting started" },
    ],
  },
  { label: "Concepts", items: conceptNavItems },
  { label: "Components", items: componentNavItems },
  {
    label: "Resources",
    items: [
      { path: "/roadmap", label: "Roadmap & changelog" },
      { path: GITHUB_URL, label: "GitHub", external: true },
    ],
  },
];
