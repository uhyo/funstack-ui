"use client";
import { use } from "react";
import { HoverCard } from "@funstack/ui/hover-card";
import { sleep } from "./fake-api.js";

interface User {
  readonly name: string;
  readonly bio: string;
  readonly repos: number;
}

const users: Record<string, User> = {
  ada: { name: "Ada Lovelace", bio: "Notes on the Analytical Engine.", repos: 12 },
  babbage: { name: "Charles Babbage", bio: "Difference engines, mostly.", repos: 3 },
};

// A pretend user API with a cache: one promise per login, read with `use()`. The first hover of
// a mention fetches (900 ms); later ones open at once.
const cache = new Map<string, Promise<User>>();
function fetchUser(login: string): Promise<User> {
  let promise = cache.get(login);
  if (promise === undefined) {
    promise = sleep(900).then(() => users[login] ?? { name: login, bio: "", repos: 0 });
    cache.set(login, promise);
  }
  return promise;
}

// Suspends until the user has loaded. The Popup has no Suspense boundary of its own, so the card
// appears complete; meanwhile the mention is `data-pending` (a dotted underline here).
function UserPreview({ login }: { login: string }) {
  const user = use(fetchUser(login));
  return (
    <>
      <strong className="demo-card-name">{user.name}</strong>
      <span className="demo-card-bio">{user.bio}</span>
      <span className="demo-card-row">
        <a href={`https://example.com/u/${login}?tab=repositories`}>{user.repos} repositories</a>
        <button type="button" className="demo-button">
          Follow
        </button>
      </span>
    </>
  );
}

// A mention inside running text: the Popup is a <span> (a <div> cannot follow the link inside a
// <p>) and holds phrasing content only, laid out with CSS. Loading starts on pointerenter and
// focus, while the 600 ms delay runs.
function Mention({ login }: { login: string }) {
  return (
    <HoverCard.Root>
      <HoverCard.Trigger
        href={`https://example.com/u/${login}`}
        className="demo-mention"
        onPointerEnter={() => void fetchUser(login)}
        onFocus={() => void fetchUser(login)}
        onClick={(event) => event.preventDefault()}
      >
        @{login}
      </HoverCard.Trigger>
      <HoverCard.Popup render={<span />} className="demo-card" align="start">
        <UserPreview login={login} />
      </HoverCard.Popup>
    </HoverCard.Root>
  );
}

export function HoverCardMentions() {
  return (
    <p>
      Thanks <Mention login="ada" /> for the review, and <Mention login="babbage" /> for the
      original design.
    </p>
  );
}
