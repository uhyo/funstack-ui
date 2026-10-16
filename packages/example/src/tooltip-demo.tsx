import { useState } from "react";
import { Tooltip } from "@funstack/ui/tooltip";
import type { TooltipAlign, TooltipSide } from "@funstack/ui/tooltip";
import "./tooltip-demo.css";

function BoldIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
      <path
        d="M4 2h5a3 3 0 0 1 2.1 5.1A3.3 3.3 0 0 1 9.5 14H4V2Zm2 2v3h3a1.5 1.5 0 0 0 0-3H6Zm0 5v3h3.5a1.5 1.5 0 0 0 0-3H6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
      <path d="M6 2h7v2h-2.6l-2.3 8H10v2H3v-2h2.6l2.3-8H6V2Z" fill="currentColor" />
    </svg>
  );
}

interface Flags {
  interestFor: boolean;
  hint: boolean;
}

function FlagsToggle({ flags, setFlags }: { flags: Flags; setFlags: (f: Flags) => void }) {
  const nativeInterest =
    typeof HTMLButtonElement !== "undefined" && "interestForElement" in HTMLButtonElement.prototype;
  return (
    <fieldset className="tooltip-flags">
      <legend>Experimental flags</legend>
      <label>
        <input
          type="checkbox"
          checked={flags.interestFor}
          onChange={(e) => setFlags({ ...flags, interestFor: e.target.checked })}
        />{" "}
        <code>experimental_interestFor</code> on every Trigger
      </label>
      <label>
        <input
          type="checkbox"
          checked={flags.hint}
          onChange={(e) => setFlags({ ...flags, hint: e.target.checked })}
        />{" "}
        <code>experimental_hint</code> on every Popup
      </label>
      <p className="tooltip-note">
        This browser {nativeInterest ? "supports" : "does not support"} <code>interestfor</code>
        {nativeInterest
          ? ": with the flag on, the browser owns hover and focus and the library attaches no listeners."
          : ": the attribute is rendered but ignored, and the JS path runs underneath."}
      </p>
    </fieldset>
  );
}

function Toolbar({ flags }: { flags: Flags }) {
  return (
    <section>
      <h3>Icon buttons: the tooltip is the name</h3>
      <p>
        <code>provides="name"</code> wires <code>aria-labelledby</code>, so the buttons are named
        "Bold" and "Italic" without an <code>aria-label</code>. Hover, or Tab to a button (focus by
        keyboard opens after the same delay; a click does not), Escape closes.
      </p>
      <div className="tooltip-toolbar" role="toolbar" aria-label="Formatting">
        <Tooltip.Root provides="name">
          <Tooltip.Trigger
            className="tooltip-icon-btn"
            experimental_interestFor={flags.interestFor}
          >
            <BoldIcon />
          </Tooltip.Trigger>
          <Tooltip.Popup className="tip" experimental_hint={flags.hint}>
            Bold
          </Tooltip.Popup>
        </Tooltip.Root>
        <Tooltip.Root provides="name">
          <Tooltip.Trigger
            className="tooltip-icon-btn"
            experimental_interestFor={flags.interestFor}
          >
            <ItalicIcon />
          </Tooltip.Trigger>
          <Tooltip.Popup className="tip" experimental_hint={flags.hint}>
            Italic
          </Tooltip.Popup>
        </Tooltip.Root>
      </div>
    </section>
  );
}

function SaveButton({ flags }: { flags: Flags }) {
  const [saved, setSaved] = useState(0);
  return (
    <section>
      <h3>Text button: the tooltip is a description</h3>
      <p>
        The default <code>provides="description"</code> wires <code>aria-describedby</code>.
        Clicking the button closes the tooltip; it stays closed until the pointer leaves and
        re-enters.
      </p>
      <Tooltip.Root>
        <Tooltip.Trigger
          className="tooltip-btn"
          experimental_interestFor={flags.interestFor}
          onClick={() => setSaved((n) => n + 1)}
        >
          Save
        </Tooltip.Trigger>
        <Tooltip.Popup className="tip" side="bottom" experimental_hint={flags.hint}>
          Saves the document (Ctrl+S)
        </Tooltip.Popup>
      </Tooltip.Root>{" "}
      <span className="tooltip-note">Saved {saved} times.</span>
    </section>
  );
}

const sides: readonly TooltipSide[] = ["top", "right", "bottom", "left"];
const aligns: readonly TooltipAlign[] = ["start", "center", "end"];

function Placement({ flags }: { flags: Flags }) {
  const [side, setSide] = useState<TooltipSide | null>("right");
  const [align, setAlign] = useState<TooltipAlign>("start");
  const [delay, setDelay] = useState(250);
  return (
    <section>
      <h3>Placement and delays</h3>
      <p>
        <code>side</code> / <code>align</code> become inline <code>position-area</code> and{" "}
        <code>position-try-fallbacks</code> (the popup flips when it does not fit).{" "}
        <code>side=&#123;null&#125;</code> leaves placement to the stylesheet (here:{" "}
        <code>.tip-custom</code>, inline-end with a larger gap).
      </p>
      <div className="tooltip-controls">
        <label>
          side{" "}
          <select
            value={side ?? "null"}
            onChange={(e) =>
              setSide(e.target.value === "null" ? null : (e.target.value as TooltipSide))
            }
          >
            {sides.map((s) => (
              <option key={s}>{s}</option>
            ))}
            <option value="null">null (stylesheet)</option>
          </select>
        </label>
        <label>
          align{" "}
          <select value={align} onChange={(e) => setAlign(e.target.value as TooltipAlign)}>
            {aligns.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          delay{" "}
          <input
            type="number"
            min={0}
            step={50}
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
          />{" "}
          ms
        </label>
      </div>
      <div className="tooltip-stage">
        <Tooltip.Root delay={delay}>
          <Tooltip.Trigger className="tooltip-btn" experimental_interestFor={flags.interestFor}>
            Hover me
          </Tooltip.Trigger>
          <Tooltip.Popup
            className={({ side: s }) => (s === null ? "tip tip-custom" : "tip")}
            side={side}
            align={align}
            experimental_hint={flags.hint}
          >
            {({ side: s, align: a }) =>
              s === null ? "Placed by the stylesheet" : `side="${s}" align="${a}"`
            }
          </Tooltip.Popup>
        </Tooltip.Root>
      </div>
    </section>
  );
}

export function TooltipDemo() {
  const [flags, setFlags] = useState<Flags>({ interestFor: false, hint: false });
  return (
    <article className="demo">
      <h2>Tooltip</h2>
      <p>
        Open state belongs to the browser (top layer): there is no <code>open</code> prop and no
        action. Styling uses <code>:popover-open</code>; the fade is pure CSS (
        <code>@starting-style</code>).
      </p>
      <FlagsToggle flags={flags} setFlags={setFlags} />
      <Toolbar flags={flags} />
      <SaveButton flags={flags} />
      <Placement flags={flags} />
    </article>
  );
}
