import { AccordionDemo } from "./accordion-demo.js";
import { CollapsibleDemo } from "./collapsible-demo.js";
import { ButtonDemo } from "./button-demo.js";
import { ToggleDemo } from "./toggle-demo.js";
import { TabsDemo } from "./tabs-demo.js";
import { TooltipDemo } from "./tooltip-demo.js";
import { HoverCardDemo } from "./hover-card-demo.js";
import { SwitchCheckboxDemo } from "./switch-checkbox-demo.js";
import { DialogDemo } from "./dialog-demo.js";
import { AlertDialogDemo } from "./alert-dialog-demo.js";
import { DrawerDemo } from "./drawer-demo.js";
import { PopoverDemo } from "./popover-demo.js";
import { MenuDemo } from "./menu-demo.js";
import { MenubarDemo } from "./menubar-demo.js";
import { NavigationMenuDemo } from "./navigation-menu-demo.js";
import { RadioGroupDemo } from "./radio-group-demo.js";
import { CheckboxGroupDemo } from "./checkbox-group-demo.js";
import { SelectDemo } from "./select-demo.js";
import { ComboboxDemo } from "./combobox-demo.js";
import { MultiSelectDemo } from "./multi-select-demo.js";
import { Notifications, ToastDemo } from "./toast-demo.js";
import { SliderDemo } from "./slider-demo.js";
import { FieldFormDemo } from "./field-form-demo.js";
import { ProgressMeterDemo } from "./progress-meter-demo.js";
import { ToolbarDemo } from "./toolbar-demo.js";
import { NumberFieldDemo } from "./number-field-demo.js";
import { OTPFieldDemo } from "./otp-field-demo.js";
import { SeparatorDemo } from "./separator-demo.js";
import { AvatarDemo } from "./avatar-demo.js";

export function App() {
  return (
    <main>
      <h1>FUNSTACK UI Playground</h1>
      <p>
        Each demo below exercises one component of <code>@funstack/ui</code>. Open the console to
        follow the fake backend calls.
      </p>
      {/* Same order as the docs sidebar: buttons, disclosure, overlays, forms, output. */}
      <ButtonDemo />
      <ToggleDemo />
      <ToolbarDemo />
      <TabsDemo />
      <AccordionDemo />
      <CollapsibleDemo />
      <TooltipDemo />
      <HoverCardDemo />
      <PopoverDemo />
      <DialogDemo />
      <AlertDialogDemo />
      <DrawerDemo />
      <MenuDemo />
      <MenubarDemo />
      <NavigationMenuDemo />
      <ToastDemo />
      <FieldFormDemo />
      <SwitchCheckboxDemo />
      <CheckboxGroupDemo />
      <RadioGroupDemo />
      <SelectDemo />
      <ComboboxDemo />
      <MultiSelectDemo />
      <SliderDemo />
      <NumberFieldDemo />
      <OTPFieldDemo />
      <ProgressMeterDemo />
      <AvatarDemo />
      <SeparatorDemo />
      {/* The toast region (a Toast.Viewport) that renders the toasts ToastDemo queues. */}
      <Notifications />
    </main>
  );
}
