// Browser rows shared by Switch and Checkbox (design/components/switch.md section 11 rows 4b, 21b
// and the DOM half of 26; real label activation, `:checked` matching and a real click before
// hydration). Imported by switch.browser.test.tsx and checkbox.browser.test.tsx, which run in
// Chromium, Firefox and WebKit.
//
// Not automated: Firefox's form-state restoration of `checked` across a reload. It needs a real
// navigation of the top-level page, which vitest browser mode cannot do from inside a test; the
// path it takes (hydration keeps the DOM value, mount reconciliation dispatches) is the same as the
// pre-hydration click covered below. TODO: cover it in an end-to-end setup once one exists.
import { act, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SwitchCheckedChangeDetails, SwitchProps } from "../switch/switch.js";
import { user } from "./browser-user.js";
import { deferred, silenceErrors, flushMicrotasks } from "./helpers.js";

type Details = SwitchCheckedChangeDetails;
type ActionFn = (next: boolean, details: Details) => unknown;

export interface CheckableInputBrowserConfig {
  readonly name: "Switch" | "Checkbox";
  readonly Control: ComponentType<SwitchProps>;
  readonly role: "switch" | "checkbox";
}

export function describeCheckableInputInBrowser(config: CheckableInputBrowserConfig): void {
  const { name, Control, role } = config;
  const input = () => screen.getByRole(role) as HTMLInputElement;

  describe(`${name} (browser)`, () => {
    it("Space toggles with the engine's own activation; Enter does not (row 4b)", async () => {
      const action = vi.fn<ActionFn>();
      render(<Control aria-label="Wi-Fi" checkedChangeAction={action} />);
      input().focus();
      expect(input()).toHaveFocus();

      await user.keyboard(" ");
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe(true);
      expect(action.mock.calls[0]?.[1].event?.type).toBe("click");
      expect(action.mock.calls[0]?.[1].reason).toBe("activate");
      expect(input().matches(":checked")).toBe(true);
      expect(input()).toHaveAttribute("data-checked", "");

      await user.keyboard("{Enter}");
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(1);
      expect(input().matches(":checked")).toBe(true);
    });

    it("a real label click dispatches once and :checked follows the optimistic state", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(
        <label>
          <Control checkedChangeAction={action} />
          Airplane mode
        </label>,
      );
      await user.click(screen.getByText("Airplane mode"));
      expect(action).toHaveBeenCalledTimes(1);
      expect(input().matches(":checked")).toBe(true);
      expect(input()).toHaveAttribute("data-pending", "");
      await act(async () => {
        d.resolve();
      });
      expect(input().matches(":checked")).toBe(true);
      expect(input()).not.toHaveAttribute("data-pending");
    });

    it("a controlled veto rolls the DOM back after settle", async () => {
      const d = deferred();
      render(<Control aria-label="Wi-Fi" checked={false} checkedChangeAction={() => d.promise} />);
      await user.click(input());
      expect(input().matches(":checked")).toBe(true);
      await act(async () => {
        d.resolve();
      });
      expect(input().matches(":checked")).toBe(false);
      expect(input()).not.toHaveAttribute("data-checked");
    });

    it("a click cancelled by a pass-through onClick does not dispatch and the DOM reverts (row 26)", async () => {
      const consoleError = silenceErrors();
      const action = vi.fn<ActionFn>();
      render(
        <Control
          aria-label="Wi-Fi"
          checkedChangeAction={action}
          onClick={(e) => e.preventDefault()}
        />,
      );
      await user.click(input());
      await flushMicrotasks();
      expect(action).not.toHaveBeenCalled();
      expect(input().checked).toBe(false);
      expect(input().matches(":checked")).toBe(false);
      expect(input()).not.toHaveAttribute("data-checked");
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("preventDefault() in the action desyncs only while pending and warns (row 19)", async () => {
      const consoleError = silenceErrors();
      const d = deferred();
      render(
        <Control
          aria-label="Wi-Fi"
          checkedChangeAction={(_next, details) => {
            details.event?.preventDefault();
            return d.promise;
          }}
        />,
      );
      await user.click(input());
      await flushMicrotasks();
      expect(input().checked).toBe(false);
      expect(input()).toHaveAttribute("data-checked", "");
      // Resolve before asserting on the warning: an unsettled async action would entangle every
      // later test's transitions with it.
      await act(async () => {
        d.resolve();
      });
      expect(input().checked).toBe(true);
      // Count only the library's warning.
      const warnings = consoleError.mock.calls.filter(([m]) =>
        String(m).startsWith(`${name}: \`preventDefault()\``),
      );
      expect(warnings).toHaveLength(1);
      consoleError.mockRestore();
    });

    it("follows React's automatic reset after a successful form action (row 21b)", async () => {
      const d = deferred();
      const submitted: [string, FormDataEntryValue][][] = [];
      function ProfileForm() {
        return (
          <form
            action={async (formData) => {
              submitted.push([...formData]);
              await d.promise;
            }}
          >
            <Control aria-label="Newsletter" name="newsletter" />
            <button type="submit">Save</button>
          </form>
        );
      }
      render(<ProfileForm />);
      await user.click(input());
      expect(input().matches(":checked")).toBe(true);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await act(async () => {
        d.resolve();
      });
      await flushMicrotasks();
      expect(submitted).toEqual([[["newsletter", "on"]]]);
      expect(input().matches(":checked")).toBe(false);
      expect(input()).not.toHaveAttribute("data-checked");
      // Still in sync: the next click turns it on.
      await user.click(input());
      expect(input().matches(":checked")).toBe(true);
      expect(input()).toHaveAttribute("data-checked", "");
    });

    it("follows a real <button type=reset> click with a platform dispatch", async () => {
      const actions: [boolean, string, string | undefined][] = [];
      function Settings() {
        const [checked, setChecked] = useState(true);
        return (
          <form>
            <Control
              aria-label="Wi-Fi"
              checked={checked}
              checkedChangeAction={(next, details) => {
                actions.push([next, details.reason, details.event?.type]);
                startTransition(() => setChecked(next));
              }}
            />
            <button type="reset">Reset</button>
          </form>
        );
      }
      render(<Settings />);
      await user.click(input());
      expect(input().checked).toBe(false);
      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(actions).toEqual([
        [false, "activate", "click"],
        [true, "platform", "reset"],
      ]);
      expect(input().matches(":checked")).toBe(true);
    });

    it("a real click before hydration is reconciled with one platform dispatch", async () => {
      const consoleError = silenceErrors();
      const action = vi.fn<ActionFn>();
      const ui: ReactNode = <Control aria-label="Wi-Fi" checkedChangeAction={action} />;
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = renderToString(ui);
      const server = container.querySelector("input")!;
      await user.click(server);
      expect(server.checked).toBe(true);

      render(ui, { container, hydrate: true });
      await flushMicrotasks();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe(true);
      expect(action.mock.calls[0]?.[1].reason).toBe("platform");
      expect(action.mock.calls[0]?.[1].event).toBeUndefined();
      expect(input()).toBe(server);
      expect(input().matches(":checked")).toBe(true);
      expect(input()).toHaveAttribute("data-checked", "");
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
}
