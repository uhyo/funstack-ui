"use client";
import { dataAttr } from "../data-attr.js";
import { pendingAriaDisabled } from "../render-element.js";
import type { DisabledButton } from "../render-element.js";
import type { WhilePending } from "../types.js";
import { useActionTrigger } from "./use-action-trigger.js";
import type { ActionTrigger } from "./use-action-trigger.js";

export interface PureTriggerOptions {
  /** The part's `whilePending` prop. */
  readonly whilePending: WhilePending | undefined;
  /**
   * The part's default when `whilePending` is omitted, which follows who owns the action
   * (conventions 2.5.1): `"run"` for `Button`, `"ignore"` for a Close part, by `closeOnActivate`
   * for `Menu.Item` / `Toast.Action`. A closing part without an `action` of its
   * own passes `whilePending: "run"` instead: nothing of its own is in flight to ignore, so it
   * shows `data-pending` while the close waits but never the pending `aria-disabled`.
   */
  readonly defaultWhilePending: WhilePending;
  /** The overlay's open generation, for a `then` that closes it (`useActionTrigger`). */
  readonly openGeneration?: (() => number) | undefined;
}

export interface PureTrigger extends ActionTrigger {
  /** The resolved `whilePending` is `"ignore"`: a run while one is in flight starts nothing. */
  readonly ignoring: boolean;
  /**
   * `run`, and `preventDefault()` on the activation when it was ignored, so an ignored click
   * does not navigate, submit or run a command either.
   */
  readonly runActivation: (
    event: { preventDefault(): void },
    work: () => unknown,
    then?: () => void,
  ) => void;
  /**
   * The owned pending keys (conventions 3.6): `aria-disabled` from the part's disabled branch
   * merged with `pending && ignoring` (`pendingAriaDisabled`: native `disabled` wins), and
   * `data-pending`. `pending` defaults to this hook's own; `Button` passes its own merged with
   * its form-channel pending.
   */
  readonly pendingProps: (
    disabledProps: DisabledButton["props"],
    pending?: boolean,
  ) => { "aria-disabled": true | undefined; "data-pending": "" | undefined };
}

/**
 * The `whilePending` wiring of a pure trigger (`Button`, `Dialog.Close` / `Popover.Close`,
 * `Menu.Item`, `Toast.Action`; conventions 2.5.1 and 3.6): resolves the part's default, passes
 * `ignoreWhilePending` to `useActionTrigger`, and renders `aria-disabled` while pending if and
 * only if the part is ignoring, plus `data-pending`.
 */
export function usePureTrigger(options: PureTriggerOptions): PureTrigger {
  const ignoring = (options.whilePending ?? options.defaultWhilePending) === "ignore";
  const { pending, run } = useActionTrigger({
    openGeneration: options.openGeneration,
    ignoreWhilePending: ignoring,
  });
  return {
    pending,
    run,
    ignoring,
    runActivation: (event, work, then) => {
      if (!run(work, then)) event.preventDefault();
    },
    pendingProps: (disabledProps, shown = pending) => ({
      "aria-disabled": pendingAriaDisabled(disabledProps, shown && ignoring),
      "data-pending": dataAttr(shown),
    }),
  };
}
