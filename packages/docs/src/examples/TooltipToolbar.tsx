// No "use client": this file is a Server Component. Tooltip has no action props, so every prop
// is serialisable and a Server Component renders it directly.
import { Tooltip } from "@funstack/ui/tooltip";

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

export function TooltipToolbar() {
  return (
    <div className="demo-row">
      <div className="demo-toolbar" role="toolbar" aria-label="Formatting">
        {/* Icon-only buttons: the tooltip text is the button's name (aria-labelledby). */}
        <Tooltip.Root provides="name">
          <Tooltip.Trigger className="demo-icon-button">
            <BoldIcon />
          </Tooltip.Trigger>
          <Tooltip.Popup className="demo-tip">Bold</Tooltip.Popup>
        </Tooltip.Root>
        <Tooltip.Root provides="name">
          <Tooltip.Trigger className="demo-icon-button">
            <ItalicIcon />
          </Tooltip.Trigger>
          <Tooltip.Popup className="demo-tip">Italic</Tooltip.Popup>
        </Tooltip.Root>
      </div>
      {/* A button with its own text: the tooltip is a description (aria-describedby). */}
      <Tooltip.Root>
        <Tooltip.Trigger className="demo-button">Save</Tooltip.Trigger>
        <Tooltip.Popup className="demo-tip" side="bottom" align="start">
          Saves the document (Ctrl+S)
        </Tooltip.Popup>
      </Tooltip.Root>
      {/* Chromium: the browser owns hover, focus and dismissal. Elsewhere: the JS path. */}
      <Tooltip.Root delay={400}>
        <Tooltip.Trigger className="demo-button" experimental_interestFor>
          Native where supported
        </Tooltip.Trigger>
        <Tooltip.Popup className="demo-tip" side="right" experimental_hint>
          interestfor + popover=&quot;hint&quot;
        </Tooltip.Popup>
      </Tooltip.Root>
    </div>
  );
}
