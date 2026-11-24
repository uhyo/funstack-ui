// The optional-part counter (Slider, NumberField and Combobox Labels, Combobox Statuses). The
// component suites cover what each count drives (aria-labelledby, the status announcements).
import { render, screen } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import { describe, expect, it } from "vitest";
import { useRegisterCount } from "./use-register-count.js";

function Part({ register }: { register: () => () => void }) {
  useLayoutEffect(register, [register]);
  return null;
}

let seenRef: RefObject<number> | undefined;
let refInLayout: number[] = [];

function Probe({ countRef }: { countRef: RefObject<number> }) {
  useLayoutEffect(() => {
    // A sibling's layout effect sees the registrations committed before it, before any re-render.
    refInLayout.push(countRef.current);
  }, [countRef]);
  return null;
}

function Owner({ parts }: { parts: number }) {
  const { count, register, countRef } = useRegisterCount();
  const [firstRegister] = useState(() => register);
  useLayoutEffect(() => {
    seenRef = countRef;
  }, [countRef]);
  return (
    <>
      <output>{count}</output>
      <span data-testid="stable">{String(firstRegister === register)}</span>
      {Array.from({ length: parts }, (_, i) => (
        <Part key={i} register={register} />
      ))}
      <Probe countRef={countRef} />
    </>
  );
}

describe("useRegisterCount", () => {
  it("counts the mounted parts and follows unmounts", () => {
    refInLayout = [];
    const { rerender } = render(<Owner parts={2} />);
    expect(screen.getByRole("status")).toHaveTextContent("2");
    expect(seenRef?.current).toBe(2);
    rerender(<Owner parts={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("3");
    rerender(<Owner parts={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("0");
    expect(seenRef?.current).toBe(0);
  });

  it("keeps register stable across renders", () => {
    const { rerender } = render(<Owner parts={1} />);
    rerender(<Owner parts={2} />);
    expect(screen.getByTestId("stable")).toHaveTextContent("true");
  });

  it("countRef is current in the mount commit, before the re-render the registration scheduled", () => {
    refInLayout = [];
    render(<Owner parts={2} />);
    // The Probe renders after the two Parts, so their layout effects ran first.
    expect(refInLayout[0]).toBe(2);
  });
});
