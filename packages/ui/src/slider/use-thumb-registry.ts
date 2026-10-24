"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { FormAssociatedElement } from "../internal/use-form-owner-event.js";

const isDev = process.env.NODE_ENV !== "production";

export interface ThumbRegistry {
  /** Thumb index → its input. Mutated in place; one identity for the Root's lifetime. */
  readonly registry: ReadonlyMap<number, HTMLInputElement>;
  /** Stable. Each Thumb registers its input from its ref; returns the unregistration. */
  readonly registerThumb: (index: number, input: HTMLInputElement) => () => void;
  /** The first registered input: the form-associated element the reset subscription follows. */
  readonly formElement: RefObject<FormAssociatedElement | null>;
}

/**
 * `Slider.Root`'s Thumb registry (design 9.2): the inputs by index, read by the residual browser
 * paths and the pointer gesture's focus. Development warns once about two Thumbs with one index
 * and once about Thumbs in different forms.
 */
export function useThumbRegistry(): ThumbRegistry {
  const [registry] = useState(() => new Map<number, HTMLInputElement>());
  const warnedDuplicate = useRef(false);
  const warnedForm = useRef(false);
  const registerThumb = useCallback(
    (index: number, input: HTMLInputElement) => {
      const existing = registry.get(index);
      if (isDev && existing !== undefined && existing !== input && !warnedDuplicate.current) {
        warnedDuplicate.current = true;
        console.error(
          `Slider.Thumb: two Thumbs have \`index={${index}}\`. Each value needs exactly one ` +
            `Thumb; give every Thumb a distinct index.`,
        );
      }
      if (isDev && !warnedForm.current) {
        for (const other of registry.values()) {
          if (other !== input && other.form !== input.form) {
            warnedForm.current = true;
            console.error(
              "Slider.Thumb: the thumbs of one Slider belong to different forms (a Thumb's " +
                "`form` prop). A form reset is followed through the first thumb's form only; " +
                "keep every thumb in one form.",
            );
            break;
          }
        }
      }
      registry.set(index, input);
      return () => {
        if (registry.get(index) === input) registry.delete(index);
      };
    },
    [registry],
  );

  const formElement = useMemo<RefObject<FormAssociatedElement | null>>(
    () => ({
      get current() {
        let first: HTMLInputElement | null = null;
        let firstIndex = Number.POSITIVE_INFINITY;
        for (const [index, input] of registry) {
          if (index < firstIndex) {
            firstIndex = index;
            first = input;
          }
        }
        return first;
      },
      set current(_ignored) {},
    }),
    [registry],
  );

  return { registry, registerThumb, formElement };
}
