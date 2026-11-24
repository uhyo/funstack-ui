"use client";
import {
  addTransitionType,
  startTransition,
  useCallback,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ActionDetails, ChangeAction } from "../types.js";
import { useLatest } from "../use-latest.js";
import { reportDropped } from "./report-dropped.js";
import { useConnected } from "./use-connected.js";
import { useDevWarning } from "../use-dev-warning.js";

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
   *
   * With a reducer, uncontrolled state is also committed through it: once every overlapping
   * dispatch has settled, the dispatches that resolved are folded onto the committed value in
   * dispatch order, and a rejected one leaves no trace (#150). Without one, the latest dispatch's
   * `next` is committed when it resolves (the latest-dispatch guard). A dispatch made with
   * `{ whole: true }` bypasses the reducer: its `next` replaces the value in both places.
   */
  reducer?: (prev: T, next: T, details: Details) => T;
  /**
   * Names used in development warnings: `component` is the public part name the messages start
   * with (`"Select.Root"`, conventions 7.2), `prop` the controlled prop (`"value"`, `"open"`).
   */
  warn: { readonly component: string; readonly prop: string };
}

export interface ControllableAction<T, Details extends ActionDetails> {
  /**
   * Committed value (`x` when it is not `undefined`, else internal state). Content regions
   * render this.
   */
  readonly committed: T;
  /** Optimistic value; trigger parts render this. */
  readonly optimistic: T;
  /** An action dispatched through this hook is in flight. */
  readonly pending: boolean;
  /**
   * Runs the action inside the hook's transition with optimistic feedback. `options.whole`
   * (internal, never part of a public details type): `next` replaces the value instead of going
   * through `reducer`, in the optimistic step and in the uncontrolled replay of the burst. For a
   * dispatch whose `next` is absolute rather than a per-item step (CheckboxGroup's form reset,
   * Accordion's mount reconciliation). Without a `reducer` every dispatch is already whole.
   */
  readonly dispatch: (next: T, details: Details, options?: DispatchOptions) => void;
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
  /**
   * A fact (#148, conventions 3.9.5): `next` is already true in the DOM
   * (the browser hid a popup the library did not hide). Supersedes every dispatch in flight (none
   * of them commits uncontrolled state; a later rejection is reported, not thrown), makes `next`
   * the in-flight intent, drops the optimistic patches of those dispatches, and in uncontrolled
   * mode writes the committed value. Never calls the action. Every write is urgent: call it from
   * the platform event's listener, outside any transition, so the change commits in that event's
   * own (discrete) commit. Advances `epoch`.
   */
  readonly adoptFact: (next: T) => void;
  /**
   * How many facts were adopted (`adoptFact`). It changes in the fact's commit even when nothing
   * else does (a controlled parent that keeps its value), so a memoised context that includes it
   * re-renders its consumers, and their effects can re-apply the value to the DOM.
   */
  readonly epoch: number;
}

/** Per-dispatch options of `ControllableAction.dispatch`. Internal. */
export interface DispatchOptions {
  /** Adopt `next` whole instead of applying `reducer` (see `dispatch`). Default `false`. */
  readonly whole?: boolean | undefined;
}

const isDev = process.env.NODE_ENV !== "production";

/** One uncontrolled reducer-mode dispatch of a burst; `resolved` once its action resolved. */
interface BurstEntry<T, Details> {
  readonly next: T;
  readonly details: Details;
  readonly reducer: (prev: T, next: T, details: Details) => T;
  /** `next` is adopted whole (`DispatchOptions.whole`), not reduced. */
  readonly whole: boolean;
  resolved: boolean;
}

/**
 * What the user intends (conventions 3.8 rule 1): the latest in-flight dispatch's `next`, else
 * `optimistic`. An explicit null check, not `?.next ?? optimistic`, which would drop an in-flight
 * dispatch of a nullish value (a pending reset to "nothing checked"). Handlers and effects only.
 * An absent `latestInFlight` (a hook option the caller may leave out) means nothing in flight.
 */
export function intendedValue<T>(
  latestInFlight: (() => { readonly next: T } | null) | undefined,
  optimistic: T,
): T {
  const inFlight = latestInFlight === undefined ? null : latestInFlight();
  return inFlight === null ? optimistic : inFlight.next;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The one place the state model of conventions section 3 is implemented: committed state,
 * optimistic state (`useOptimistic`, reducer form), the component's own transition, the
 * post-`await` write of uncontrolled state, the latest-dispatch guard, and the reporting of the
 * rejections React would drop: superseded ones, and the latest one once the owner left
 * (conventions 2.4).
 */
export function useControllableAction<T, Details extends ActionDetails = ActionDetails>(
  options: UseControllableActionOptions<T, Details>,
): ControllableAction<T, Details> {
  const { controlled, defaultValue, initialValue, action, transitionTypes, reducer, warn } =
    options;

  const [internal, setInternal] = useState<T>(
    defaultValue === undefined ? initialValue : defaultValue,
  );
  const isControlled = controlled !== undefined;
  const committed = isControlled ? controlled : internal;
  // The fact epoch (`adoptFact`): urgent state. A patch carries the epoch of its dispatch and the
  // reducer of the render ignores it once the render's epoch is newer: React re-applies pending
  // optimistic updates on every render with that render's reducer, so one urgent `setEpoch` drops
  // every patch of a superseded dispatch in the fact's own commit (probed, issue-148 memo). The
  // passthrough stays the plain committed value: an object passthrough (`{ value, epoch }`, the
  // design's sketch) defeats React's bailout of a render whose state did not change, which an
  // inline ref re-run on every render turns into an update loop.
  const [epoch, setEpoch] = useState(0);
  const epochRef = useRef(0);
  const [optimistic, setOptimistic] = useOptimistic(
    committed,
    (prev: T, patch: { next: T; details: Details; epoch: number; whole: boolean }) =>
      patch.epoch < epoch
        ? prev
        : reducer && !patch.whole
          ? reducer(prev, patch.next, patch.details)
          : patch.next,
  );
  const [pending, startOwnTransition] = useTransition();
  const latest = useRef(0);
  const inFlight = useRef<{ count: number; next: T | undefined }>({ count: 0, next: undefined });
  /** The uncontrolled reducer-mode dispatches of the current burst (overlapping), in order. */
  const burst = useRef<BurstEntry<T, Details>[]>([]);
  const connected = useConnected();

  useDevWarnings(isControlled, defaultValue !== undefined, warn);

  // The functions below keep one identity for the hook's lifetime, so the returned object changes
  // only with `committed`, `optimistic` and `pending`, and the components' memoised context values
  // are reused across renders that change none of them. They read the props of the last
  // committed render through `props`; they run from handlers, actions and effects, never render.
  const props = useLatest({ committed, isControlled, action, transitionTypes, reducer });

  /**
   * Marks a dispatch settled. When it was the last one in flight, the uncontrolled reducer-mode
   * dispatches of the burst that resolved are committed, in dispatch order (see `reducer`).
   */
  const settle = useCallback((): void => {
    inFlight.current.count -= 1;
    if (inFlight.current.count > 0) return;
    inFlight.current.next = undefined;
    const resolved = burst.current.filter((entry) => entry.resolved);
    burst.current = [];
    if (resolved.length === 0) return;
    startTransition(() =>
      setInternal((prev) =>
        resolved.reduce(
          (value, entry) =>
            entry.whole ? entry.next : entry.reducer(value, entry.next, entry.details),
          prev,
        ),
      ),
    );
  }, []);

  const dispatch = useCallback(
    (next: T, details: Details, options?: DispatchOptions): void => {
      const whole = options?.whole ?? false;
      // Read once, at the call, as the per-render closure did: the action, the mode and the
      // previous value belong to the UI the user acted on, even after the `await`.
      const { committed: prev, isControlled, action, transitionTypes, reducer } = props.current;
      const id = ++latest.current;
      const dispatchEpoch = epochRef.current;
      inFlight.current.count += 1;
      inFlight.current.next = next;
      // Uncontrolled with a reducer: committed from the burst once every dispatch settled.
      const entry: BurstEntry<T, Details> | null =
        !isControlled && reducer ? { next, details, reducer, whole, resolved: false } : null;
      if (entry) burst.current.push(entry);
      startOwnTransition(async () => {
        for (const type of transitionTypes?.(next, prev, details) ?? []) addTransitionType(type);
        setOptimistic({ next, details, epoch: dispatchEpoch, whole });
        try {
          await action?.(next, details);
        } catch (error) {
          settle();
          // The latest dispatch's rejection takes React's own route to the boundary while the
          // owner is there to render it. React drops a superseded one (it keeps only the newest
          // thenable) and one whose owner unmounted or is hidden: reported instead (2.4, #152).
          if (id === latest.current && connected.current) throw error;
          reportDropped(error);
          return;
        }
        if (entry) entry.resolved = true;
        settle();
        if (!isControlled && !entry && id === latest.current) {
          startTransition(() => setInternal(next));
        }
      });
    },
    [props, settle, setOptimistic, connected],
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

  const adoptFact = useCallback(
    (next: T): void => {
      // Supersede: no dispatch in flight is the latest any more, so none commits and a later
      // rejection is reported (2.4). Their settles still count down `inFlight`.
      latest.current += 1;
      if (inFlight.current.count > 0) inFlight.current.next = next;
      burst.current = [];
      epochRef.current += 1;
      setEpoch(epochRef.current);
      if (!props.current.isControlled) setInternal(next);
    },
    [props],
  );

  return useMemo(
    () => ({ committed, optimistic, pending, dispatch, latestInFlight, adopt, adoptFact, epoch }),
    [committed, optimistic, pending, dispatch, latestInFlight, adopt, adoptFact, epoch],
  );
}

function useDevWarnings(
  isControlled: boolean,
  hasDefault: boolean,
  warn: { readonly component: string; readonly prop: string },
): void {
  const [initialMode] = useState(isControlled);
  const { component, prop } = warn;
  const defaultProp = isDev && `default${capitalize(prop)}`;

  useDevWarning(
    isControlled && hasDefault,
    isDev &&
      `${component}: both \`${prop}\` and \`${defaultProp}\` are set. ` +
        `Use \`${prop}\` for controlled mode or \`${defaultProp}\` for uncontrolled mode, not both.`,
  );
  useDevWarning(
    initialMode !== isControlled,
    isDev &&
      `${component}: \`${prop}\` changed from ${initialMode ? "controlled" : "uncontrolled"} to ` +
        `${isControlled ? "controlled" : "uncontrolled"}. Switching modes after mount ` +
        `is not supported; keep \`${prop}\` either always defined or always undefined.`,
  );
}
