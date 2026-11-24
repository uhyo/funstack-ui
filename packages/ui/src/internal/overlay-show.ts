// Two pieces of the popup state machine that usePopoverPopup (Popover, Menu, Combobox) and
// Dialog.Popup share: the close / echo / refused-fact flags, and the show wrapper (the refused
// re-open's `inert` guard and the `autofocus` write around the show call). What differs stays
// with the caller: whether a refused fact applies to the show (Dialog: non-modal dialogs only),
// the initial focus target, the show call itself. No "use client" directive: no hook, no React
// (conventions 7.1); a Popup keeps its flags with `useState(createPopupFlags)`.

/**
 * The bookkeeping flags of one Popup between a platform event and the apply effect
 * (design/components/popover.md 2.5, dialog.md 2.3, conventions 3.9.2 and 3.9.4).
 */
export interface PopupFlags {
  /**
   * `awaitingClose`: set by the synchronous `beforetoggle` of a close, cleared by the close's
   * `toggle` / `close` event a task later. While set the popup is hidden but its event has not
   * arrived, so the apply effect must not show it again from a commit that lands in between.
   */
  readonly awaitingClose: () => boolean;
  readonly beginClose: () => void;
  readonly endClose: () => void;
  /**
   * The library echo (`libraryHide` / `libraryClose`): marked right before the apply effect's
   * own hide, consumed by the next `toggle` / `close` event. That hide is the library's; every
   * other is a fact. The echo is recognised by its source, not by what is intended: a dismissal
   * during a pending part close is a fact.
   */
  readonly markLibraryClose: () => void;
  /** Reads and clears the echo marker. */
  readonly takeLibraryClose: () => boolean;
  /**
   * `refusedFact`: marked when a fact hid the popup, cleared by a commit with committed `false`
   * (the fact was adopted). A show while it is set is the re-open of a dismissal a controlled
   * parent refused (conventions 3.9.4), which leaves focus where the dismissal put it.
   */
  readonly markFact: () => void;
  readonly factAdopted: () => void;
  /**
   * Reads and clears the refused-fact flag; call once per show, also when the caller does not
   * apply it (a modal dialog).
   */
  readonly takeRefusedFact: () => boolean;
  /**
   * The popup element the callback ref attached. A different element than the last one ends the
   * close and drops the echo (#159): the old element went away with its listeners, so its queued
   * `toggle` / `close` event never reaches the Popup, and the new element has no close pending
   * (a remount mid-close, such as a change of `transition`). Called at the ref's attach, before
   * the commit's layout effects, so that commit's apply already sees it. The same element
   * attached again (a new merged ref, StrictMode) keeps both: its event still comes.
   */
  readonly attach: (element: Element) => void;
}

/** A fresh set of flags, all clear. Keep one per Popup instance (`useState(createPopupFlags)`). */
export function createPopupFlags(): PopupFlags {
  let awaitingClose = false;
  let libraryClose = false;
  let refusedFact = false;
  let attached: Element | null = null;
  return {
    awaitingClose: () => awaitingClose,
    beginClose: () => {
      awaitingClose = true;
    },
    endClose: () => {
      awaitingClose = false;
    },
    markLibraryClose: () => {
      libraryClose = true;
    },
    takeLibraryClose: () => {
      const echo = libraryClose;
      libraryClose = false;
      return echo;
    },
    markFact: () => {
      refusedFact = true;
    },
    factAdopted: () => {
      refusedFact = false;
    },
    takeRefusedFact: () => {
      const refused = refusedFact;
      refusedFact = false;
      return refused;
    },
    attach: (element) => {
      if (element === attached) return;
      attached = element;
      awaitingClose = false;
      libraryClose = false;
    },
  };
}

export interface ShowWithFocusOptions {
  /**
   * The show is the re-open of a refused fact (#155, #156): the popup is `inert` for the duration
   * of `show`, so the platform's focusing steps find nothing focusable and do nothing (the dialog
   * focusing steps of a `<dialog>`, a consumer's own `autofocus`). The element the dismissal
   * focused sees no blur. A consumer's own `inert` is left alone.
   */
  readonly refused: boolean;
  /**
   * The element to carry `autofocus` during `show`, or `null`. The platform's focusing steps
   * honour the attribute; React drops `autoFocus` on client-rendered content (react/react#23301),
   * and the library never calls `.focus()` for initial focus (popover.md 6.1). An element that
   * already has the attribute keeps it.
   */
  readonly autofocus: HTMLElement | null;
  /** The show itself (`showPopover()`, `showModal()`, `show()`), called synchronously once. */
  readonly show: () => void;
}

/**
 * Runs a library show with the refused re-open's `inert` guard and the initial focus `autofocus`
 * write, both undone right after the call (also when it throws).
 */
export function showWithFocus(
  element: HTMLElement,
  { refused, autofocus, show }: ShowWithFocusOptions,
): void {
  const inerted = refused && !element.hasAttribute("inert");
  if (inerted) element.setAttribute("inert", "");
  const autofocused = autofocus !== null && !autofocus.hasAttribute("autofocus") ? autofocus : null;
  autofocused?.setAttribute("autofocus", "");
  try {
    show();
  } finally {
    autofocused?.removeAttribute("autofocus");
    if (inerted) element.removeAttribute("inert");
  }
}
