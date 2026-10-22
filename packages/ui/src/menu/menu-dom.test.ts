// Unit rows for the DOM helpers' disabled predicate (design/components/button.md 16.4 M6): an
// item is disabled by its `disabled` prop (`data-disabled`), not by `aria-disabled`, which an
// item also carries while its own action is pending (#81).
import { afterEach, describe, expect, it } from "vitest";
import { edgeItem, isDisabledItem } from "./menu-dom.js";

function menu(html: string): HTMLElement {
  const popup = document.createElement("div");
  popup.setAttribute("role", "menu");
  popup.innerHTML = html;
  document.body.append(popup);
  return popup;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isDisabledItem", () => {
  it('is true for data-disabled=""', () => {
    const popup = menu('<button role="menuitem" aria-disabled="true" data-disabled="">A</button>');
    expect(isDisabledItem(popup.firstElementChild!)).toBe(true);
  });

  it('is false for aria-disabled="true" without data-disabled (a pending item)', () => {
    const popup = menu('<button role="menuitem" aria-disabled="true" data-pending="">A</button>');
    expect(isDisabledItem(popup.firstElementChild!)).toBe(false);
  });

  it("is false for a plain item", () => {
    const popup = menu('<button role="menuitem">A</button>');
    expect(isDisabledItem(popup.firstElementChild!)).toBe(false);
  });
});

describe("edgeItem (the open focus)", () => {
  it("a pending first item is the first enabled item; a disabled one is skipped", () => {
    const pendingFirst = menu(
      '<button role="menuitem" id="a" aria-disabled="true" data-pending="">A</button>' +
        '<button role="menuitem" id="b">B</button>',
    );
    expect(edgeItem(pendingFirst, "first")?.id).toBe("a");
    document.body.innerHTML = "";
    const disabledEdges = menu(
      '<button role="menuitem" id="a" aria-disabled="true" data-disabled="">A</button>' +
        '<button role="menuitem" id="b">B</button>' +
        '<button role="menuitem" id="c" aria-disabled="true" data-disabled="">C</button>',
    );
    expect(edgeItem(disabledEdges, "first")?.id).toBe("b");
    expect(edgeItem(disabledEdges, "last")?.id).toBe("b");
  });
});
