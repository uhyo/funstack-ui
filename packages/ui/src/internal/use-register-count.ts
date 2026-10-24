"use client";
import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";

export interface RegisterCount {
  /** How many parts are registered, as of this render. */
  readonly count: number;
  /** Stable. Call from a layout effect (`useLayoutEffect(register, [register])`); returns the unregistration. */
  readonly register: () => () => void;
  /** The same count, current before the re-render a registration scheduled (effects only). */
  readonly countRef: RefObject<number>;
}

/** Counts the mounted instances of an optional part (Slider's and NumberField's Labels). */
export function useRegisterCount(): RegisterCount {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const register = useCallback(() => {
    countRef.current += 1;
    setCount((c) => c + 1);
    return () => {
      countRef.current -= 1;
      setCount((c) => c - 1);
    };
  }, []);
  return { count, register, countRef };
}
