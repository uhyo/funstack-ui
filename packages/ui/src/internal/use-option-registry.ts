"use client";
import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import { sortByDocumentOrder } from "./dom-order.js";
import { useLatest } from "./use-latest.js";
import { useRegisterCount } from "./use-register-count.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * What a mounted listbox option (`Combobox.Option`, `MultiSelect.Option`) tells its Root
 * (design/components/combobox.md 2, "mounted options, labels").
 */
export interface ListboxOptionEntry {
  readonly element: HTMLElement;
  /** The `label` prop; `undefined`: the element's trimmed `textContent` at the moment of use. */
  readonly label: string | undefined;
  readonly disabled: boolean;
}

export interface OrderedOption extends ListboxOptionEntry {
  readonly value: string;
}

/** The id fragment of an option value: stable across result sets, no whitespace (combobox.md 3.5). */
export function optionId(prefix: string, value: string): string {
  return `${prefix}${encodeURIComponent(value)}`;
}

/** The text of an option: its `label` prop, else its trimmed `textContent` now. */
export function optionLabel(entry: ListboxOptionEntry): string {
  return entry.label ?? (entry.element.textContent ?? "").trim();
}

export interface OptionRegistry {
  /** The mounted Options by value. */
  readonly registry: ReadonlyMap<string, ListboxOptionEntry>;
  readonly optionCount: number;
  readonly statusCount: number;
  /**
   * The same count for the announcement effect: the open commit's passive effects can run before
   * the re-render the Status's registration scheduled (the race `registry` avoids for options).
   */
  readonly statusCountRef: RefObject<number>;
  readonly labelCount: number;
  readonly registerOption: (value: string, entry: ListboxOptionEntry) => () => void;
  readonly registerStatus: () => () => void;
  readonly registerLabel: () => () => void;
  /** The registered Options in document order. */
  readonly orderedOptions: () => OrderedOption[];
}

/**
 * The Options, Statuses and Labels mounted in a listbox component, Combobox or MultiSelect
 * (design/components/combobox.md 2, 6.5; multi-select.md B.15). An Option's label is learnt into
 * `labels` (the label cache, combobox.md 2.3) as it registers.
 */
export function useOptionRegistry(
  /** The namespace for the duplicate-value warning (`"Combobox"`). */
  component: string,
  labels: Map<string, string>,
  /** Called with every label learnt from a registering Option (the chips, combobox.md 15.1). */
  onLabel?: (value: string, label: string) => void,
): OptionRegistry {
  const onLabelRef = useLatest(onLabel);
  const [registry] = useState(() => new Map<string, ListboxOptionEntry>());
  const [optionCount, setOptionCount] = useState(0);
  const {
    count: statusCount,
    register: registerStatus,
    countRef: statusCountRef,
  } = useRegisterCount();
  const { count: labelCount, register: registerLabel } = useRegisterCount();
  const warnedDuplicate = useRef(false);

  const registerOption = useCallback(
    (optionValue: string, entry: ListboxOptionEntry) => {
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
          `${component}.Option: two options have the value ${JSON.stringify(optionValue)}. ` +
            `Option ids are derived from the value, so they must be unique within one ${component}.`,
        );
      }
      registry.set(optionValue, entry);
      const label = optionLabel(entry);
      labels.set(optionValue, label);
      onLabelRef.current?.(optionValue, label);
      setOptionCount(registry.size);
      return () => {
        if (registry.get(optionValue) === entry) registry.delete(optionValue);
        setOptionCount(registry.size);
      };
    },
    [component, registry, labels, onLabelRef],
  );

  const orderedOptions = useCallback((): OrderedOption[] => {
    const options: OrderedOption[] = [];
    for (const [optionValue, entry] of registry) options.push({ value: optionValue, ...entry });
    return sortByDocumentOrder(options, (option) => option.element);
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
