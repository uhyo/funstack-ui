import { startTransition, useState, ViewTransition } from "react";
import { Avatar } from "@funstack/ui/avatar";
import { Demo } from "./shared/Demo.js";
import "./avatar-demo.css";

/** A unique picture each call (a canvas blob URL), so no cache makes it complete at once. */
async function freshPicture(): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext("2d")!;
  const hue = Math.floor(Math.random() * 360);
  const gradient = context.createLinearGradient(0, 0, 160, 160);
  gradient.addColorStop(0, `hsl(${hue} 70% 55%)`);
  gradient.addColorStop(1, `hsl(${(hue + 60) % 360} 70% 45%)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 160, 160);
  context.fillStyle = "rgb(255 255 255 / 0.85)";
  context.beginPath();
  context.arc(80, 64, 28, 0, Math.PI * 2);
  context.fill();
  context.fillRect(30, 108, 100, 52);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!)));
  return URL.createObjectURL(blob);
}

function Person({ name, initials, src }: { name: string; initials: string; src?: string }) {
  return (
    <Avatar.Root
      alt={name}
      className="av"
      render={(props, { status }) => (
        <figure className="av-figure">
          <span {...props} />
          <figcaption>
            {name} <code>{status}</code>
          </figcaption>
        </figure>
      )}
    >
      <Avatar.Image src={src} className="av-image" />
      <Avatar.Fallback className="av-fallback">{initials}</Avatar.Fallback>
    </Avatar.Root>
  );
}

/** Statuses: a picture that loads, one that fails, none at all. */
function Statuses() {
  const [src, setSrc] = useState<string | undefined>(undefined);
  return (
    <section>
      <h3>Statuses</h3>
      <div className="av-row">
        <Person name="Ada Lovelace" initials="AL" src={src} />
        <Person name="Grace Hopper" initials="GH" src="/does-not-exist.png" />
        <Person name="Alan Turing" initials="AT" />
      </div>
      <button type="button" onClick={() => void freshPicture().then(setSrc)}>
        Give Ada a new picture
      </button>
    </section>
  );
}

/**
 * React's commit wait: the card mounts in a transition under a <ViewTransition>, so react-dom
 * holds the commit until the picture is decoded (bounded) and the avatar starts "loaded", never
 * showing the initials. The checkbox adds an onLoad prop, React's opt-out: then the card commits
 * at once and the status passes through "loading".
 */
function CommitWait() {
  const [card, setCard] = useState<string | null>(null);
  const [optOut, setOptOut] = useState(false);
  const show = async () => {
    const src = await freshPicture();
    startTransition(() => setCard(src));
  };
  return (
    <section>
      <h3>Under a ViewTransition</h3>
      <label>
        <input type="checkbox" checked={optOut} onChange={(e) => setOptOut(e.target.checked)} /> Opt
        out with an <code>onLoad</code> prop
      </label>
      <p>
        <button type="button" onClick={() => void show()}>
          Show a profile card
        </button>{" "}
        <button type="button" onClick={() => startTransition(() => setCard(null))}>
          Hide
        </button>
      </p>
      <ViewTransition>
        {card !== null && (
          <div className="av-card">
            <Avatar.Root alt="Katherine Johnson" className="av">
              <Avatar.Image
                src={card}
                className="av-image"
                {...(optOut && { onLoad: () => console.log("onLoad (opted out of the wait)") })}
              />
              <Avatar.Fallback className="av-fallback">KJ</Avatar.Fallback>
            </Avatar.Root>
            <span>Katherine Johnson</span>
          </div>
        )}
      </ViewTransition>
    </section>
  );
}

export function AvatarDemo() {
  return (
    <Demo title="Avatar">
      <Statuses />
      <CommitWait />
    </Demo>
  );
}
