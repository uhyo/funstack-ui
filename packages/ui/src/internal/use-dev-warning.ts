"use client";
import { useEffect, useRef, useState } from "react";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Logs `message` through `console.error` once per component instance, the first time
 * `condition` is true. Runs in an effect (never during render) so the warning cannot fire for a
 * render that is discarded.
 *
 * Pass the message as `isDev && "..."` with the calling module's own `isDev` constant: the text
 * then folds away in a production build (`src/__tests__/production-bundle.test.ts` checks it).
 * In production the hook is a no-op.
 */
export const useDevWarning: (condition: boolean, message: string | false) => void = isDev
  ? useDevWarningDev
  : noop;

function useDevWarningDev(condition: boolean, message: string | false): void {
  const warned = useRef(false);
  useEffect(() => {
    if (!condition || message === false || warned.current) return;
    warned.current = true;
    console.error(message);
  }, [condition, message]);
}

function noop(): void {}

/** The names a mode warning uses: the public part and the controlled prop (`x`). */
export interface ModeWarningNames {
  /** The public part name the messages start with (`"Combobox.Root"`). */
  readonly component: string;
  /** The controlled prop; the default prop is `default<Prop>`. */
  readonly prop: string;
}

/**
 * The two development warnings of every controllable state (conventions 3.1), the urgent ones
 * included: both `x` and `defaultX` set, and a switch between controlled and uncontrolled after
 * mount. Once each per instance. Called by `useControllableAction` (and through it
 * `useStepCommit`) and by the owners of an urgent state (`OTPField.Root`'s `value`, Combobox's
 * `inputValue`). In production the warnings are no-ops.
 */
export function useModeWarnings(
  controlled: boolean,
  hasDefault: boolean,
  names: ModeWarningNames,
): void {
  const [initialMode] = useState(controlled);
  const { component, prop } = names;
  const defaultProp = isDev && `default${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
  useDevWarning(
    controlled && hasDefault,
    isDev &&
      `${component}: both \`${prop}\` and \`${defaultProp}\` are set. ` +
        `Use \`${prop}\` for controlled mode or \`${defaultProp}\` for uncontrolled mode, not both.`,
  );
  useDevWarning(
    initialMode !== controlled,
    isDev &&
      `${component}: \`${prop}\` changed from ${initialMode ? "controlled" : "uncontrolled"} to ` +
        `${controlled ? "controlled" : "uncontrolled"}. Switching modes after mount ` +
        `is not supported; keep \`${prop}\` either always defined or always undefined.`,
  );
}
