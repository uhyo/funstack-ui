"use client";
import {
  addTransitionType,
  startTransition,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ActionDetails, ChangeAction } from "./types.js";

export interface UseControllableActionOptions<T, Details extends ActionDetails> {
  /** The controlled prop (`x`). `undefined` means uncontrolled. */
  controlled: T | undefined;
  /** The `defaultX` prop as the consumer passed it; `undefined` when omitted. */
  defaultValue: T | undefined;
  /** Initial uncontrolled value when neither `x` nor `defaultX` is given. */
  initialValue: T;
  /** The `xChangeAction` prop. Awaited inside this hook's transition. */
  action: ChangeAction<T, Details> | undefined;
  /** View Transition types to attach to the commit that ends a dispatch. */
  transitionTypes?: (next: T, prev: T) => readonly string[];
  /** Names used in development warnings. */
  warn?: { readonly component: string; readonly prop: string };
}

export interface ControllableAction<T, Details extends ActionDetails> {
  /** Committed value (`x ?? internal`). Content regions render this. */
  readonly committed: T;
  /** Optimistic value; trigger parts render this. */
  readonly optimistic: T;
  /** An action dispatched through this hook is in flight. */
  readonly pending: boolean;
  /** Runs the action inside the hook's transition with optimistic feedback. */
  readonly dispatch: (next: T, details: Details) => void;
}

const isDev = process.env.NODE_ENV !== "production";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The one place the state model of conventions section 3 is implemented: committed state,
 * optimistic state (`useOptimistic`, reducer form), the component's own transition, the
 * post-`await` write of uncontrolled state, and the latest-dispatch guard.
 */
export function useControllableAction<T, Details extends ActionDetails = ActionDetails>(
  options: UseControllableActionOptions<T, Details>,
): ControllableAction<T, Details> {
  const { controlled, defaultValue, initialValue, action, transitionTypes, warn } = options;

  const [internal, setInternal] = useState<T>(
    defaultValue === undefined ? initialValue : defaultValue,
  );
  const isControlled = controlled !== undefined;
  const committed = isControlled ? controlled : internal;
  const [optimistic, setOptimistic] = useOptimistic(committed, (_prev: T, next: T) => next);
  const [pending, startOwnTransition] = useTransition();
  const latest = useRef(0);

  useDevWarnings(isControlled, defaultValue !== undefined, warn);

  function dispatch(next: T, details: Details): void {
    const prev = committed;
    const id = ++latest.current;
    startOwnTransition(async () => {
      for (const type of transitionTypes?.(next, prev) ?? []) addTransitionType(type);
      setOptimistic(next);
      await action?.(next, details);
      if (!isControlled && id === latest.current) {
        startTransition(() => setInternal(next));
      }
    });
  }

  return { committed, optimistic, pending, dispatch };
}

function useDevWarnings(
  isControlled: boolean,
  hasDefault: boolean,
  warn: { readonly component: string; readonly prop: string } | undefined,
): void {
  const initialMode = useRef(isControlled);
  const warnedBoth = useRef(false);
  const warnedSwitch = useRef(false);
  const component = warn?.component ?? "A component";
  const prop = warn?.prop ?? "value";

  useEffect(() => {
    if (!isDev) return;
    const defaultProp = `default${capitalize(prop)}`;

    if (isControlled && hasDefault && !warnedBoth.current) {
      warnedBoth.current = true;
      console.error(
        `${component}: both \`${prop}\` and \`${defaultProp}\` are set. ` +
          `Use \`${prop}\` for controlled mode or \`${defaultProp}\` for uncontrolled mode, not both.`,
      );
    }

    if (initialMode.current !== isControlled && !warnedSwitch.current) {
      warnedSwitch.current = true;
      const from = initialMode.current ? "controlled" : "uncontrolled";
      const to = isControlled ? "controlled" : "uncontrolled";
      console.error(
        `${component}: \`${prop}\` changed from ${from} to ${to}. Switching modes after mount ` +
          `is not supported; keep \`${prop}\` either always defined or always undefined.`,
      );
    }
  }, [component, prop, isControlled, hasDefault]);
}
