"use client";
import {
  addTransitionType,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ActionDetails, ChangeAction } from "./types.js";
import { useLatest } from "./use-latest.js";

export interface UseControllableActionOptions<T, Details extends ActionDetails> {
  /** The controlled prop (`x`). `undefined` means uncontrolled. */
  controlled: T | undefined;
  /** The `defaultX` prop as the consumer passed it; `undefined` when omitted. */
  defaultValue: T | undefined;
  /** Initial uncontrolled value when neither `x` nor `defaultX` is given. */
  initialValue: T;
  /** The `xChangeAction` prop. Awaited inside this hook's transition. */
  action: ChangeAction<T, Details> | undefined;
  /**
   * View Transition types to attach to the commit that ends a dispatch. Receives the previous
   * committed value and the details object (Tabs derives next/prev direction from them).
   */
  transitionTypes?: (next: T, prev: T, details: Details) => readonly string[];
  /**
   * Optimistic reducer (conventions 3.4). Default: replace the value with `next`. Multi-item
   * states (Accordion's open set) pass a reducer keyed by item, reading the item from `details`,
   * so stacked optimistic patches re-base onto a changed committed value.
   */
  reducer?: (prev: T, next: T, details: Details) => T;
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
  /**
   * The `next` of the most recent dispatch while any dispatch's action is still unsettled, else
   * `null`. Lets a component with a browser-owned path (Accordion's find-in-page reveal) build on
   * what the user already intends instead of on the DOM. Read it from handlers and effects only.
   */
  readonly latestInFlight: () => { readonly next: T } | null;
  /**
   * Uncontrolled mode only (a no-op when controlled): writes the committed value without calling
   * the action, without an optimistic step and without a transition. For a component that adopts
   * a default the browser chose (Select with neither `value` nor `defaultValue` takes the first
   * enabled option, design/components/select.md 5). Call it from a layout effect so the write is
   * flushed before paint.
   */
  readonly adopt: (next: T) => void;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * What the user intends (conventions 3.8 rule 1): the latest in-flight dispatch's `next`, else
 * `optimistic`. An explicit null check, not `?.next ?? optimistic`, which would drop an in-flight
 * dispatch of a nullish value (a pending reset to "nothing checked"). Handlers and effects only.
 */
export function intendedValue<T>(
  latestInFlight: () => { readonly next: T } | null,
  optimistic: T,
): T {
  const inFlight = latestInFlight();
  return inFlight === null ? optimistic : inFlight.next;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Reports an error that cannot reach a boundary (conventions 2.4: never swallow). */
function report(error: unknown): void {
  if (typeof reportError === "function") reportError(error);
  else console.error(error);
}

/**
 * The one place the state model of conventions section 3 is implemented: committed state,
 * optimistic state (`useOptimistic`, reducer form), the component's own transition, the
 * post-`await` write of uncontrolled state, the latest-dispatch guard, and the surfacing of
 * superseded rejections (conventions 2.4).
 */
export function useControllableAction<T, Details extends ActionDetails = ActionDetails>(
  options: UseControllableActionOptions<T, Details>,
): ControllableAction<T, Details> {
  const { controlled, defaultValue, initialValue, action, transitionTypes, reducer, warn } =
    options;

  // React keeps only the newest thenable per `useTransition`, so a rejection from a dispatch that
  // was superseded by a later one would be dropped entirely (no boundary, no `reportError`). The
  // hook catches those itself, keeps the first, and throws it from render so it reaches the same
  // nearest Error Boundary as the latest dispatch's rejection does through React.
  //
  // The throw sits before `useTransition` on purpose: React retries an errored render with every
  // pending lane, and in that retry `useTransition` unwraps the still-pending action thenable and
  // suspends, which would hold the boundary commit until the newer action settles.
  const [supersededError, setSupersededError] = useState<{ readonly error: unknown } | null>(null);
  const hasSupersededError = useRef(false);
  if (supersededError !== null) throw supersededError.error;

  const [internal, setInternal] = useState<T>(
    defaultValue === undefined ? initialValue : defaultValue,
  );
  const isControlled = controlled !== undefined;
  const committed = isControlled ? controlled : internal;
  const [optimistic, setOptimistic] = useOptimistic(
    committed,
    (prev: T, patch: { next: T; details: Details }) =>
      reducer ? reducer(prev, patch.next, patch.details) : patch.next,
  );
  const [pending, startOwnTransition] = useTransition();
  const latest = useRef(0);
  const inFlight = useRef<{ count: number; next: T | undefined }>({ count: 0, next: undefined });
  const mounted = useRef(false);

  useDevWarnings(isControlled, defaultValue !== undefined, warn);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The functions below keep one identity for the hook's lifetime, so the returned object changes
  // only with `committed`, `optimistic` and `pending`, and the components' memoised context values
  // are reused across renders that change none of them. They read the props of the last
  // committed render through `props`; they run from handlers, actions and effects, never render.
  const props = useLatest({ committed, isControlled, action, transitionTypes });

  const settle = useCallback((): void => {
    inFlight.current.count -= 1;
    if (inFlight.current.count === 0) inFlight.current.next = undefined;
  }, []);

  const dispatch = useCallback(
    (next: T, details: Details): void => {
      // Read once, at the call, as the per-render closure did: the action, the mode and the
      // previous value belong to the UI the user acted on, even after the `await`.
      const { committed: prev, isControlled, action, transitionTypes } = props.current;
      const id = ++latest.current;
      inFlight.current.count += 1;
      inFlight.current.next = next;
      startOwnTransition(async () => {
        for (const type of transitionTypes?.(next, prev, details) ?? []) addTransitionType(type);
        setOptimistic({ next, details });
        try {
          await action?.(next, details);
        } catch (error) {
          settle();
          // The latest dispatch's rejection takes React's own route to the boundary.
          if (id === latest.current) throw error;
          // Nothing to throw to once unmounted (React drops its own thenables the same way).
          if (!mounted.current) return;
          if (hasSupersededError.current) {
            // One boundary reset per burst is enough; later errors are still reported.
            report(error);
            return;
          }
          hasSupersededError.current = true;
          // Outside the transition by now (after an await), so this is an urgent update: the
          // owner re-renders promptly and throws.
          setSupersededError({ error });
          return;
        }
        settle();
        if (!isControlled && id === latest.current) {
          startTransition(() => setInternal(next));
        }
      });
    },
    [props, settle, setOptimistic],
  );

  const latestInFlight = useCallback((): { readonly next: T } | null => {
    const { count, next } = inFlight.current;
    return count > 0 ? { next: next as T } : null;
  }, []);

  const adopt = useCallback(
    (next: T): void => {
      if (!props.current.isControlled) setInternal(next);
    },
    [props],
  );

  return useMemo(
    () => ({ committed, optimistic, pending, dispatch, latestInFlight, adopt }),
    [committed, optimistic, pending, dispatch, latestInFlight, adopt],
  );
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
