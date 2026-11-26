"use client";
// Three people: a picture that loads, one whose picture fails (initials take its place), and one
// with no picture at all. Each Root is named by `alt`; the status under each avatar comes from
// the Root's `render` function, so it sits outside the role="img" element. "Change picture"
// swaps Ada's source: the status goes back to "loading" until the new one is in.
import { Avatar } from "@funstack/ui/avatar";
import { useState } from "react";

/** A self-contained picture (an SVG data URL), so the example needs no image host. */
function picture(from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
<defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="80" height="80" fill="url(#g)"/><circle cx="40" cy="32" r="14" fill="#fff" fill-opacity=".85"/>
<path d="M14 80c4-18 14-26 26-26s22 8 26 26z" fill="#fff" fill-opacity=".85"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const pictures = [picture("#6366f1", "#ec4899"), picture("#0ea5e9", "#22c55e")];

const people = [
  { id: "ada", name: "Ada Lovelace", initials: "AL" },
  // Bytes that are no image: decoding fails, as for a URL that is gone, and the Fallback stays.
  { id: "grace", name: "Grace Hopper", initials: "GH", src: "data:image/png;base64,AAAA" },
  { id: "alan", name: "Alan Turing", initials: "AT" },
];

export function AvatarPeople() {
  const [picked, setPicked] = useState(0);
  return (
    <div className="demo-stack">
      <ul className="demo-avatar-people">
        {people.map((person) => (
          <li key={person.id}>
            <Avatar.Root
              alt={person.name}
              className="demo-avatar"
              // The function form wraps the avatar in a figure, so the caption is outside the
              // role="img" element (its children are presentational).
              render={(props, { status }) => (
                <figure className="demo-avatar-figure">
                  <span {...props} />
                  <figcaption>
                    {person.name}
                    <code>{status}</code>
                  </figcaption>
                </figure>
              )}
            >
              <Avatar.Image
                className="demo-avatar-image"
                src={person.id === "ada" ? pictures[picked] : person.src}
                width={80}
                height={80}
              />
              <Avatar.Fallback className="demo-avatar-fallback">{person.initials}</Avatar.Fallback>
            </Avatar.Root>
          </li>
        ))}
      </ul>
      <p>
        <button
          type="button"
          className="demo-button"
          onClick={() => setPicked((p) => (p + 1) % pictures.length)}
        >
          Change Ada&apos;s picture
        </button>
      </p>
    </div>
  );
}
