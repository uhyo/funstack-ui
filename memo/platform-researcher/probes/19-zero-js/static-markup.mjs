// Plain SSR (no react-server condition, no hydration): the existing "use client" parts render to
// complete HTML; nothing is shipped because nothing hydrates.
import { createElement as h } from "react";
import { prerender } from "react-dom/static";
import { Accordion } from "@funstack/ui/accordion";
import { Tooltip } from "@funstack/ui/tooltip";
import { Switch } from "@funstack/ui/switch";
const app = h("main", null,
  h(Accordion.Root, { exclusive: true },
    h(Accordion.Item, { value: "a", defaultOpen: true }, h(Accordion.Trigger, null, "One"), h(Accordion.Panel, null, "A")),
    h(Accordion.Item, { value: "b" }, h(Accordion.Trigger, null, "Two"), h(Accordion.Panel, null, "B"))),
  h(Tooltip.Root, null, h(Tooltip.Trigger, { experimental_interestFor: true }, "Save"), h(Tooltip.Popup, { experimental_hint: true }, "Saves")),
  h("label", null, h(Switch, { name: "wifi", defaultChecked: true }), " Wi-Fi"));
const { prelude } = await prerender(app);
console.log(await new Response(prelude).text());
