import { describe, expectTypeOf, it } from "vitest";
import { Avatar } from "./index.js";
import type { AvatarImageProps, AvatarRootProps, AvatarState, AvatarStatus } from "./index.js";

/**
 * Type-level checks (design/components/avatar.md 3). `expectTypeOf` is a no-op at runtime;
 * `pnpm typecheck` (`tsc` over the test files) makes these fail.
 */
describe("Avatar props", () => {
  it("the state carries the status", () => {
    expectTypeOf<AvatarStatus>().toEqualTypeOf<"idle" | "loading" | "loaded" | "error">();
    expectTypeOf<AvatarState>().toEqualTypeOf<{ readonly status: AvatarStatus }>();
  });

  it("alt is required on the Root and is a string", () => {
    expectTypeOf<AvatarRootProps["alt"]>().toEqualTypeOf<string>();
    void (<Avatar.Root alt="Jane" />);
    void (<Avatar.Root alt="" />);
    // @ts-expect-error alt is required: a name, or "" for decoration
    void (<Avatar.Root />);
  });

  it("the Root owns role and aria-label", () => {
    // @ts-expect-error the role follows from alt
    void (<Avatar.Root alt="J" role="presentation" />);
  });

  it("the Image takes the img element's props but not alt", () => {
    expectTypeOf<AvatarImageProps["src"]>().toEqualTypeOf<string | undefined>();
    void (
      <Avatar.Root alt="J">
        <Avatar.Image
          src="/a.png"
          srcSet="/a.png 1x, /a@2x.png 2x"
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          fetchPriority="high"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          className={(s) => s.status}
        />
      </Avatar.Root>
    );
    // @ts-expect-error alt belongs to the Root
    void (<Avatar.Image src="/a.png" alt="Jane" />);
    // @ts-expect-error an img has no children
    void (<Avatar.Image src="/a.png">x</Avatar.Image>);
  });

  it("the Fallback's children may be a function of the state", () => {
    void (<Avatar.Fallback>{(s) => (s.status === "error" ? "!" : "JD")}</Avatar.Fallback>);
  });
});
