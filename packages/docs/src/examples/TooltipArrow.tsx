// No "use client": a Server Component, like the toolbar example. Tooltip.Arrow is a client part
// that only reads its Popup's placement, so it renders from here as is.
import { Tooltip } from "@funstack/ui/tooltip";

export function TooltipArrow() {
  return (
    <div className="demo-row">
      {/* Asked for the top: near the top of the window the browser flips it below, and the
          arrow follows (data-side is the side the browser chose). */}
      <Tooltip.Root>
        <Tooltip.Trigger className="demo-button">Above, or below</Tooltip.Trigger>
        <Tooltip.Popup className="demo-tip demo-tip-arrowed">
          Points at its trigger after a flip too
          <Tooltip.Arrow className="demo-tip-arrow" />
        </Tooltip.Popup>
      </Tooltip.Root>
      {/* inline-end: the right of the trigger here, its left in a right-to-left page. */}
      <Tooltip.Root>
        <Tooltip.Trigger className="demo-button">Inline end</Tooltip.Trigger>
        <Tooltip.Popup className="demo-tip demo-tip-arrowed" side="inline-end">
          Beside the trigger, in reading direction
          <Tooltip.Arrow className="demo-tip-arrow" />
        </Tooltip.Popup>
      </Tooltip.Root>
      {/* The same in a right-to-left container: align="start" lines up the right edges. */}
      <div dir="rtl" className="demo-row">
        <Tooltip.Root>
          <Tooltip.Trigger className="demo-button">بداية</Tooltip.Trigger>
          <Tooltip.Popup className="demo-tip demo-tip-arrowed" side="bottom" align="start">
            محاذاة إلى البداية
            <Tooltip.Arrow className="demo-tip-arrow" />
          </Tooltip.Popup>
        </Tooltip.Root>
      </div>
    </div>
  );
}
