"use client";
import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ComboboxOptionEntry } from "./combobox-context.js";

const isDev = process.env.NODE_ENV !== "production";

export interface OrderedOption extends ComboboxOptionEntry {
  readonly value: string;
}

export interface OptionRegistry {
  /** The mounted Options by value. */
  readonly registry: ReadonlyMap<string, ComboboxOptionEntry>;
  readonly optionCount: number;
  readonly statusCount: number;
  /**
   * The same count for the announcement effect: the open commit's passive effects can run before
   * the re-render the Status's registration scheduled (the race `registry` avoids for options).
   */
  readonly statusCountRef: RefObject<number>;
  readonly labelCount: number;
  readonly registerOption: (value: string, entry: ComboboxOptionEntry) => () => void;
  readonly registerStatus: () => () => void;
  readonly registerLabel: () => () => void;
  /** The registered Options in document order. */
  readonly orderedOptions: () => OrderedOption[];
}

/**
 * The Options, Statuses and Labels mounted in a Combobox (design/components/combobox.md 2, 6.5).
 * An Option's label is learnt into `labels` (design 2.3) as it registers.
 */
export function useOptionRegistry(labels: Map<string, string>): OptionRegistry {
  const [registry] = useState(() => new Map<string, ComboboxOptionEntry>());
  const [optionCount, setOptionCount] = useState(0);
  const [statusCount, setStatusCount] = useState(0);
  const statusCountRef = useRef(0);
  const [labelCount, setLabelCount] = useState(0);
  const warnedDuplicate = useRef(false);

  const registerOption = useCallback(
    (optionValue: string, entry: ComboboxOptionEntry) => {
      const existing = registry.get(optionValue);
      if (
        isDev &&
        !warnedDuplicate.current &&
        existing !== undefined &&
        existing.element !== entry.element &&
        existing.element.isConnected
      ) {
        warnedDuplicate.current = true;
        console.error(
          `Combobox.Option: two options have the value ${JSON.stringify(optionValue)}. ` +
            "Option ids are derived from the value, so they must be unique within one Combobox.",
        );
      }
      registry.set(optionValue, entry);
      labels.set(optionValue, entry.label ?? (entry.element.textContent ?? "").trim());
      setOptionCount(registry.size);
      return () => {
        if (registry.get(optionValue) === entry) registry.delete(optionValue);
        setOptionCount(registry.size);
      };
    },
    [registry, labels],
  );

  const registerStatus = useCallback(() => {
    statusCountRef.current += 1;
    setStatusCount((count) => count + 1);
    return () => {
      statusCountRef.current -= 1;
      setStatusCount((count) => count - 1);
    };
  }, []);

  const registerLabel = useCallback(() => {
    setLabelCount((count) => count + 1);
    return () => setLabelCount((count) => count - 1);
  }, []);

  const orderedOptions = useCallback((): OrderedOption[] => {
    const options: OrderedOption[] = [];
    for (const [optionValue, entry] of registry) options.push({ value: optionValue, ...entry });
    options.sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    return options;
  }, [registry]);

  return {
    registry,
    optionCount,
    statusCount,
    statusCountRef,
    labelCount,
    registerOption,
    registerStatus,
    registerLabel,
    orderedOptions,
  };
}
