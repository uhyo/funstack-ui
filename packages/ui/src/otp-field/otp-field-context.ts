"use client";
import { createContext, use } from "react";
import type { ChangeEvent, RefObject } from "react";
import type { OTPFieldCharset } from "./otp-field-filter.js";
import type { OTPFieldState } from "./otp-field-root.js";

export interface OTPFieldContextValue {
  /** The state every part's function props receive. */
  readonly state: OTPFieldState;
  readonly charset: OTPFieldCharset;
  /** Own `name` ?? the Field's. */
  readonly name: string | undefined;
  readonly form: string | undefined;
  /** Own `required` || the Field's. */
  readonly required: boolean;
  /** Inside a `Field.Root`: whether an error is shown. `undefined` outside a Field. */
  readonly fieldInvalid: boolean | undefined;
  /** The text the Input renders: the raw text while a composition is open, else the value. */
  readonly inputText: string;
  /** The active slots, `[from, to)` (design 4.3). */
  readonly active: readonly [from: number, to: number];
  readonly experimentalWebOTP: boolean;
  /** The Input element. */
  readonly inputRef: RefObject<HTMLInputElement | null>;
  /** The Input's `onChange`: the filter of design 4.1. */
  readonly change: (event: ChangeEvent<HTMLInputElement>) => void;
  /** The Input's native listeners (installed by the Input on its element). */
  readonly beforeInput: (event: InputEvent) => void;
  readonly compositionStart: () => void;
  readonly compositionEnd: (event: CompositionEvent) => void;
  readonly selectionChanged: () => void;
  readonly blurred: () => void;
  readonly click: (event: MouseEvent) => void;
  /** The Input's mount: adopts text typed, autofilled or restored before hydration (design 9). */
  readonly inputMounted: () => void;
  /** A WebOTP credential's code (design 8). */
  readonly webOTPCode: (code: string) => void;
  /** The pending WebOTP request, aborted when the code is completed by hand. */
  readonly webOTPAbort: RefObject<AbortController | null>;
  /** Registers a Slot's element under its index; returns the cleanup. */
  readonly registerSlot: (index: number, element: HTMLElement) => () => void;
}

export const OTPFieldContext = createContext<OTPFieldContextValue | null>(null);

export function useOTPFieldContext(part: string): OTPFieldContextValue {
  const context = use(OTPFieldContext);
  if (context === null) throw new Error(`${part} must be rendered inside an OTPField.Root.`);
  return context;
}
