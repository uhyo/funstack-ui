import { AccordionDemo } from "./accordion-demo";
import { ButtonDemo } from "./button-demo";
import { ToggleDemo } from "./toggle-demo";
import { TabsDemo } from "./tabs-demo";
import { TooltipDemo } from "./tooltip-demo";
import { SwitchCheckboxDemo } from "./switch-checkbox-demo";
import { DialogDemo } from "./dialog-demo";
import { PopoverDemo } from "./popover-demo";
import { MenuDemo } from "./menu-demo";
import { RadioGroupDemo } from "./radio-group-demo";
import { CheckboxGroupDemo } from "./checkbox-group-demo";
import { SelectDemo } from "./select-demo";
import { ComboboxDemo } from "./combobox-demo";
import { Notifications, ToastDemo } from "./toast-demo";
import { SliderDemo } from "./slider-demo";
import { FieldFormDemo } from "./field-form-demo";
import { ProgressMeterDemo } from "./progress-meter-demo";
import { ToolbarDemo } from "./toolbar-demo";
import { NumberFieldDemo } from "./number-field-demo";

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
      <TooltipDemo />
      <PopoverDemo />
      <DialogDemo />
      <MenuDemo />
      <ToastDemo />
      <FieldFormDemo />
      <SwitchCheckboxDemo />
      <CheckboxGroupDemo />
      <RadioGroupDemo />
      <SelectDemo />
      <ComboboxDemo />
      <SliderDemo />
      <NumberFieldDemo />
      <ProgressMeterDemo />
      {/* The toast region (a Toast.Viewport) that renders the toasts ToastDemo queues. */}
      <Notifications />
    </main>
  );
}
