import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example, ExampleSource } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { ToastArchive } from "../examples/ToastArchive.js";
import { ToastNotifications } from "../examples/ToastNotifications.js";
import { ToastUndoWindow } from "../examples/ToastUndoWindow.js";
import { ToastUrgent } from "../examples/ToastUrgent.js";
import { functionProps, renderProp } from "./shared-props.js";

export function ToastPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Toast"
        description="Notifications fed by a toast() function and rendered by your own Viewport: an urgent queue that shows while the action it reports on is still pending, promise toasts, an Undo action prop, closeAction for the Undo window, ariaNotify announcements, and a region that stays interactive above modal dialogs."
      />
      <h2>Toast</h2>
      <p className="page-intro">
        Toasts report on something that already happened or is happening elsewhere. The input is a
        function, <code>toast()</code>, callable from anywhere: an action body, a store, an effect.
        The output is yours: a <code>Toast.Viewport</code> rendered once maps the queue to parts.
        The queue is the library's first state that is <strong>urgent by design</strong>: React
        holds every transition while an async action is pending, so a toast pushed as a transition
        would appear only after the action it reports on. Toast spends its Async React budget
        elsewhere: a toast that follows a promise, an Undo that is an ordinary action prop with{" "}
        <code>data-pending</code>, a <code>closeAction</code> that knows whether the Undo window was
        used, and a Suspense guard so a toast whose content suspends does not blank the page.
      </p>

      {/* The one Viewport of this page; every example below feeds it. */}
      <ToastNotifications />

      <Example file="ToastArchive.tsx" css="toast.css">
        <ToastArchive />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Toast, toast } from "@funstack/ui/toast";

// Once, near the root of the app (from a Client Component: children is a function).
<Toast.Viewport>                          {/* section[popover=manual][aria-label="Notifications (F8)"] */}
  {({ toasts }) =>
    toasts.map((t) => (
      <Toast.Root key={t.id} toast={t}>   {/* div[role=dialog|alertdialog][tabindex=0] */}
        <Toast.Title />                   {/* div: t.title */}
        <Toast.Description />             {/* p: t.description, nothing when absent */}
        <Toast.Action />                  {/* button: t.action, nothing when absent */}
        <Toast.Close aria-label="Close">×</Toast.Close>
      </Toast.Root>
    ))
  }
</Toast.Viewport>

// Anywhere on the client:
toast({ title: "Link copied" });`}</CodeBlock>
      <p>This page's Viewport, which every example on it feeds:</p>
      <ExampleSource file="ToastNotifications.tsx" />
      <ul>
        <li>
          <strong>No Provider.</strong> <code>toast</code> is bound to a module-level default
          manager; a Viewport without <code>manager</code> renders it. A second Viewport on the same
          manager warns and renders nothing. <code>createToastManager()</code> makes an isolated
          queue (a second React root, a test) for <code>{"<Toast.Viewport manager={m}>"}</code>.
        </li>
        <li>
          <strong>No list element, no Portal part.</strong> Toasts are focusable <code>dialog</code>
          s (<code>alertdialog</code> for <code>priority: "high"</code>) named by their Title and
          described by their Description. The region is wherever the Viewport is rendered; its only
          move (into a modal dialog) is the library's. On the client it sits inside two{" "}
          <code>display: contents</code> wrappers: an anchor where the Viewport is rendered, and the
          element the library moves.
        </li>
        <li>
          The Title is a <code>div</code>, not a heading: transient notifications stay out of
          heading navigation.
        </li>
        <li>
          Calls made before the Viewport mounts are buffered and shown when it does. A Viewport that
          unmounts leaves its toasts with the manager for the next one (timers stop; no{" "}
          <code>closeAction</code> runs).
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <h4>The urgent queue</h4>
      <p>
        Every queue change (add, update, dismiss, the drop after an exit animation) is a normal,
        urgent update. <code>toast()</code> dispatches from a microtask, so a call inside a{" "}
        <code>startTransition</code> scope, the sync prefix of an action included, escapes the scope
        and shows at once; calls keep their order. Everything a toast <em>drives</em> is a
        transition as usual: its Action's action and its <code>closeAction</code>.
      </p>
      <Example file="ToastUrgent.tsx">
        <ToastUrgent />
      </Example>
      <p>
        <code>limit</code> (default 3) toasts render at once; later ones wait in order and show as
        earlier ones leave. Nothing is dropped, so an Undo is never lost to a burst.{" "}
        <code>state.queued</code> counts the waiting ones. A <code>toast()</code> with an existing{" "}
        <code>id</code> updates that toast in place ("one toast per key").
      </p>

      <h4>Promise toasts</h4>
      <p>
        <code>toast.promise(promise, {"{ pending, success, error }"})</code> shows{" "}
        <code>pending</code> at once with <code>data-pending</code> and no timer, and replaces it
        with <code>success</code> or <code>error</code> (options, or functions of the value / the
        reason) when the promise settles: same toast, same element, announced again. It returns a
        promise that settles with the input in the same tick, so{" "}
        <code>{"action={() => toast.promise(save(), …)}"}</code> keeps the part that started the
        work pending for exactly as long.
      </p>
      <Table
        head={["The promise", "Toast", "Returned promise"]}
        rows={[
          ["fulfils, `success` given", "replaced by `success`", "resolves with the value"],
          ["fulfils, no `success`", 'dismissed (`reason: "dismiss"`)', "resolves with the value"],
          [
            "rejects, `error` given",
            "replaced by `error`",
            "**resolves** with `undefined`: the toast is the handler",
          ],
          [
            "rejects, no `error`",
            "dismissed",
            "rejects with the reason (the action prop's Error Boundary gets it)",
          ],
          [
            "a `success` / `error` function throws",
            "dismissed (never left pending)",
            "rejects with what the function threw",
          ],
        ]}
      />

      <h4>Undo and closeAction</h4>
      <p>
        <code>Toast.Action</code> is a{" "}
        <a href="/concepts/pending-and-optimistic#pure-trigger">pure trigger</a>, like{" "}
        <code>Menu.Item</code>. While its action runs the Action and the Root carry{" "}
        <code>data-pending</code> and the toast's timer is paused; when it resolves the toast closes
        with <code>reason: "activate"</code> (unless <code>closeOnSettle={"{false}"}</code>). A
        rejection keeps the toast and reaches the nearest Error Boundary{" "}
        <strong>above the Viewport</strong>: put one around the list.
      </p>
      <Callout kind="warning" title="A caught error closes the toast">
        <p>
          A <code>catch</code> inside the action resolves it, and a resolved action closes the
          toast, so a "Could not undo" written with <code>toast.update</code> in the{" "}
          <code>catch</code> is never seen. Rethrow after the update (the toast stays; the boundary
          above the Viewport gets the error), or use <code>closeOnSettle={"{false}"}</code> and{" "}
          <code>toast.dismiss(details.id)</code> on success.
        </p>
      </Callout>
      <p>
        A toast's <code>closeAction</code> runs once when it leaves, in the Viewport's transition,
        after the toast is already gone: <code>"activate"</code> (its Action settled),{" "}
        <code>"dismiss"</code> (Close, Escape, <code>toast.dismiss()</code>, a promise toast with no
        message for its outcome) or <code>"timeout"</code>. That is the "do later, unless undone"
        pattern:
      </p>
      <Example file="ToastUndoWindow.tsx">
        <ToastUndoWindow />
      </Example>

      <h4>Timers</h4>
      <p>
        A toast's timer starts once it is visible (within <code>limit</code>), its content has
        rendered and it is not pending, and resumes with the remaining time after a pause. Timers
        pause while the pointer is over the region, focus is inside it, the document is hidden or
        the window is blurred (<code>data-paused</code>), and per toast while it is pending.
        Elapsing closes the toast with <code>reason: "timeout"</code>. Pausing helps sighted users;
        the persistent default for action toasts and the hotkey are what give screen-reader users
        time to reach an Undo.
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>toast(options)</code> and the manager
      </h4>
      <PropsTable
        rows={[
          {
            name: "toast(options)",
            type: "(options: ToastOptions) => string",
            description:
              "Adds a toast and returns its id (or updates the toast with `options.id`). Also `toast.add`.",
          },
          {
            name: "toast.promise",
            type: "<T>(promise: PromiseLike<T>, options: ToastPromiseOptions<T>) => Promise<T | undefined>",
            description:
              "`{ pending, success?, error?, id? }`; `success` / `error` are options or functions of the value / reason. See the table above.",
          },
          {
            name: "toast.update",
            type: "(id: string, options: Partial<ToastOptions>) => void",
            description:
              "Changes a toast in place; `undefined` removes a field. Ignored for a closed toast; an unknown id warns in development.",
          },
          {
            name: "toast.dismiss",
            type: "(id?: string) => void",
            description: 'Closes one toast, or all, with `reason: "dismiss"`. Idempotent.',
          },
          {
            name: "createToastManager",
            type: "() => ToastManager",
            description: "An isolated queue with the same shape, for `Toast.Viewport manager`.",
          },
        ]}
      />
      <p>
        On the server every method is a no-op with a development warning, and nothing is buffered (a
        module-level queue would be shared between requests). Return data from a Server Function and
        call <code>toast()</code> on the client.
      </p>
      <h4>
        <code>ToastOptions</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "title",
            type: "ReactNode",
            description: "Rendered by `Toast.Title`; part of the default announcement.",
          },
          {
            name: "description",
            type: "ReactNode",
            description: "Rendered by `Toast.Description`; part of the default announcement.",
          },
          {
            name: "id",
            type: "string",
            default: "generated",
            description: "An existing id updates that toast.",
          },
          {
            name: "type",
            type: "string",
            description: 'Free-form (`"success"`, `"error"`), rendered as `data-type` on the Root.',
          },
          {
            name: "priority",
            type: '"normal" | "high"',
            default: '"normal"',
            description:
              '`"high"`: announced with `ariaNotify` priority `"high"`, Root role `alertdialog`.',
          },
          {
            name: "duration",
            type: "number | null",
            default: "Viewport `duration`; `null` with an `action`",
            description:
              'Milliseconds until the toast closes with `reason: "timeout"`; `null` never. A toast with an `action` is persistent unless you set it; if you do, keep the action reachable elsewhere too (WCAG 2.2.1).',
          },
          {
            name: "action",
            type: "{ label: ReactNode; action: Action<[ToastActionDetails]> }",
            description:
              "What `Toast.Action` renders and runs. `details.id` is the toast's id, so an inline action can update or dismiss its own toast.",
          },
          {
            name: "closeAction",
            type: "Action<[ToastCloseDetails]>",
            description:
              'Runs once when the toast leaves, in the Viewport\'s transition; `details.reason` is `"activate"`, `"dismiss"` or `"timeout"`. Not called when the Viewport unmounts.',
          },
          {
            name: "announce",
            type: "(toast: ToastItem) => string | null",
            description:
              "The text `ariaNotify` speaks for this toast; `null` for nothing. Wins over the Viewport's `announce`.",
          },
          {
            name: "data",
            type: "unknown",
            description: "Anything your Viewport children want to render.",
          },
        ]}
      />
      <p>
        <code>ToastItem</code>, what <code>state.toasts</code> holds: the options plus{" "}
        <code>id</code>, <code>pending</code> (its promise is unsettled or its Action runs) and{" "}
        <code>ending</code> (closed, kept for its exit animation).
      </p>

      <h4>
        <code>Toast.Viewport</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "manager",
            type: "ToastManager",
            default: "toast",
            description: "The queue to render.",
          },
          {
            name: "limit",
            type: "number",
            default: "3",
            description: "Toasts rendered at once; the rest wait in order.",
          },
          {
            name: "duration",
            type: "number | null",
            default: "5000",
            description: "Default `duration` of a toast without an `action`.",
          },
          {
            name: "hotkey",
            type: "string[] | null",
            default: '["F8"]',
            description:
              '`event.code` values and modifier names (`"altKey"`, `"ctrlKey"`, `"metaKey"`, `"shiftKey"`) that focus the newest toast, with no other modifier held (Ctrl+F8 is not F8). Also names the region (`"Notifications (Alt+T)"`). `null` installs no listener.',
          },
          {
            name: "announce",
            type: "(toast: ToastItem) => string | null",
            description:
              "The announcement text for every toast (localisation). Default: the text of its Title and Description.",
          },
          {
            name: "aria-label",
            type: "string",
            default: '"Notifications (F8)"',
            description: "The region's name; yours is used verbatim.",
          },
          ...functionProps(
            "ToastViewportState",
            "Usually a function of the state that maps `state.toasts` to `Toast.Root`s.",
          ),
          renderProp("section", "ToastViewportState"),
        ]}
      />
      <PartFacts
        state={
          "`ToastViewportState` is `{ toasts, queued, paused }`; `toasts` is chronological (oldest first) and includes the ones animating out; `paused` is true while a viewport-wide pause holds."
        }
        owned={
          '`popover` (`"manual"`), `aria-label` (your own wins verbatim), `data-paused`, `data-empty`, and the pointer and focus handlers.'
        }
      />

      <h4>
        <code>Toast.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "toast",
            type: "ToastItem",
            description:
              "Required. An item of `state.toasts`; key the Root (or its wrapper) on `toast.id`.",
          },
          {
            name: "fallback",
            type: "ReactNode",
            default: "null",
            description:
              "Shown inside the Root while its children suspend (a skeleton). The timer and the announcement wait for the reveal; the Root is not `data-pending` meanwhile. Parts inside it (a visually hidden `Toast.Title`) name the toast but gate nothing.",
          },
          ...functionProps("ToastRootState"),
          renderProp("div", "ToastRootState"),
        ]}
      />
      <PartFacts
        state={"`ToastRootState` is `{ toast, pending, ending, type, priority }`."}
        owned={
          '`role` (`dialog`, or `alertdialog` for `priority: "high"`), `tabIndex`, `aria-labelledby`, `aria-describedby`, `inert` (while ending), `onKeyDown`, `data-type`, `data-pending`, `data-ending`.'
        }
        note={
          "`Toast.Title` (`div`) and `Toast.Description` (`p`) take the same function props against the Root's state; their `children` default to `toast.title` / `toast.description`, and the Description renders nothing when it has neither."
        }
      />

      <h4>
        <code>Toast.Action</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "action",
            type: "Action<[ToastActionDetails]>",
            default: "toast.action.action",
            description:
              "Runs in this part's transition. The part renders nothing when neither it nor the toast has an action.",
          },
          {
            name: "closeOnSettle",
            type: "boolean",
            default: "true",
            description: 'Close the toast (`reason: "activate"`) when the action resolves.',
          },
          ...functionProps("ToastActionState", "Default: `toast.action.label`."),
          renderProp("button", "ToastActionState"),
        ]}
      />
      <PartFacts
        state={"`ToastActionState` is `{ pending, toast }`."}
        owned={"`type` (on a `<button>` only), `onClick`, `aria-disabled`, `data-pending`."}
        note={
          'A second click while the action is pending is ignored (and cancelled): one Undo, one Retry. The Action is `aria-disabled="true"` while it shows `data-pending`, never natively disabled, so it keeps focus.'
        }
      />

      <h4>
        <code>Toast.Close</code>
      </h4>
      <PropsTable
        rows={[...functionProps("ToastCloseState"), renderProp("button", "ToastCloseState")]}
      />
      <PartFacts
        state={"`ToastCloseState` is `{ toast }`."}
        owned={"`type` (on a `<button>` only), `onClick`."}
        note={
          'Closes the toast with `reason: "dismiss"`, like Escape. Give it a name (text or `aria-label`); development warns otherwise.'
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "Part", "Meaning"]}
        rows={[
          [
            "`data-pending`",
            "Root, Action",
            "The toast's promise is unsettled, or its Action's action runs (not set while its content merely suspends)",
          ],
          ["`aria-disabled`", "Action", '`"true"` while `data-pending`: a second click is ignored'],
          [
            "`data-ending`",
            "Root",
            "Closed, kept (and `inert`) until the animations the ending state started finish",
          ],
          ["`data-type`", "Root", "The toast's `type`"],
          [
            "`data-paused`",
            "Viewport",
            "A viewport-wide timer pause holds; pause a progress bar with it",
          ],
          ["`data-empty`", "Viewport", "No toasts rendered"],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Where", "Behaviour"]}
        rows={[
          [
            "F8 (`hotkey`)",
            "anywhere",
            "Focus the newest toast; nothing (and no `preventDefault`) without toasts",
          ],
          [
            "Tab / Shift+Tab",
            "region",
            "Through each toast and its buttons in DOM order; nothing is trapped",
          ],
          ["ArrowDown / ArrowUp", "a toast", "Next / previous toast, no wrap"],
          ["Escape", "a toast", "Dismiss it"],
          ["Enter / Space", "Action, Close", "Native button activation"],
        ]}
      />
      <ul>
        <li>
          When the toast holding focus closes, focus moves to the next toast, else the previous one,
          else back to where it was before the region was entered (by F8 or Tab), else the body.
        </li>
        <li>
          F8, not F6: F6 is the browsers' pane-cycling key. Change it with <code>hotkey</code>.
        </li>
        <li>
          <strong>Announcements</strong> go through <code>document.ariaNotify()</code>, never a live
          region: after the toast's content has rendered, again when an update changes its text,
          with <code>priority: "high"</code> for high-priority toasts; several toasts in one tick
          become one announcement. Dismissals are silent. A queued toast is announced when it is
          added.
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "None. Every Toast commit is urgent (so a toast shows even while an async action holds every transition), no part takes a `transition` prop, and React starts view transitions for transition commits only. Animate with CSS (`@starting-style`, `[data-ending]`)."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "No optimistic state. `data-pending` is on the Root while the toast's promise is unsettled or its Action's action runs, and on that Action, which is a [pure trigger](/concepts/pending-and-optimistic#pure-trigger)."
        }
      />

      <BehaviourSection
        id="suspense"
        summary={"Toast content may suspend; each Root has its own boundary and a `fallback` prop."}
      >
        <p>
          Toast content may suspend (<code>{"title: <UserName id={id} />"}</code>). Each Root wraps
          its children in its own Suspense boundary, so a suspending toast does not pull the
          Viewport into the nearest boundary above it (a toast mounts urgently, where that boundary
          would show its fallback). While the content suspends the Root shows its{" "}
          <code>fallback</code> prop (nothing by default), in the same frame as the{" "}
          <code>toast()</code> call; the timer does not run and nothing is announced. On the reveal
          the toast announces its Title and Description and its timer starts. An update whose new
          content suspends shows the <code>fallback</code> again and pauses the timer until the next
          reveal.
        </p>
        <CodeBlock>{`<Toast.Root key={t.id} toast={t} fallback={<ToastSkeleton />}>
  <Toast.Title />
  <Toast.Description />
</Toast.Root>`}</CodeBlock>
        <p>
          Use <code>fallback</code> rather than your own <code>&lt;Suspense&gt;</code> inside the
          Root: the toast is still announced when your boundary reveals its Title and Description,
          but its timer starts at once, because the library cannot see your boundary's fallback.
        </p>
      </BehaviourSection>

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'The region is a `popover="manual"` in the top layer, shown while it has toasts and never light-dismissed. Its stack is library-owned.'
        }
      >
        <h4>Top layer and modal dialogs</h4>
        <p>
          The region is <code>popover="manual"</code>: shown while it has toasts, it neither closes
          an open menu or popover nor is closed by one, and it has no light dismiss. A toast added
          while a later menu or popover covers the region raises it to the top again. A top-layer
          element outside an open modal <code>&lt;dialog&gt;</code> is inert, so while a{" "}
          <a href="/components/dialog">Dialog</a> is open as a modal the region moves into it (and
          back when it closes): an Undo stays clickable. The move keeps the toasts' React state (an
          Undo in flight stays pending), but it is a DOM move: the toasts' enter animation plays
          again and focus inside a toast is lost. Dialogs the library did not open are not detected.
        </p>
      </BehaviourSection>

      <BehaviourSection id="before-hydration" summary={"Toasts appear only after hydration."}>
        <p>
          <code>{"<Toast.Viewport>"}</code> takes a function child, so render it from a Client
          Component file that a Server Component layout includes. On the server it renders the empty
          region. <code>toast()</code> is client code: a Server Function returns data and the client
          calls <code>toast()</code> with it (in the action that called it, or in an effect on{" "}
          <code>useActionState</code>'s result).
        </p>
      </BehaviourSection>

      <h3 id="styling">Styling</h3>
      <p>
        Enter with <code>@starting-style</code>, exit on <code>[data-ending]</code>: the library
        keeps a closed toast mounted until the animations (transitions included) that{" "}
        <code>[data-ending]</code> started finish. Animations already running in the toast, such as
        a progress bar paused with <code>data-paused</code>, are not waited for. Toasts never use{" "}
        <code>&lt;ViewTransition&gt;</code> and no part has a <code>transition</code> prop: every
        Toast commit is urgent, and react-dom starts view transitions for transition commits only.
        Make the region's box click-through with <code>pointer-events: none</code> and give it back
        to the toasts; stack visually with <code>flex-direction: column-reverse</code> and{" "}
        <code>:nth-last-child()</code>.
      </p>

      <h3 id="browser-notes">Browser notes</h3>
      <ul>
        <li>
          <code>ariaNotify</code> is in Chrome 141, Firefox 150 and Safari 27; where it is missing
          nothing is announced and nothing throws.
        </li>
        <li>No swipe to dismiss yet: Close, Escape and the timer cover WCAG 2.5.1.</li>
      </ul>
    </div>
  );
}
