"use client";
import { useActionState } from "react";
import { Dialog } from "@funstack/ui/dialog";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import type { FieldErrorValue, FormErrors } from "@funstack/ui/form";
import { sleep } from "./fake-api.js";

interface TaskState {
  readonly errors?: FormErrors;
  readonly error?: FieldErrorValue;
}

let attempts = 0;

// A pretend Server Function with two kinds of failure. "Groceries" already exists: a field
// error, about that value, which blocks the same title until it is edited. Every other first
// attempt "cannot reach the server": a form-level error, which keeps the dialog open and lets
// the same values be submitted again (the retry succeeds).
async function createTask(_prev: TaskState, formData: FormData): Promise<TaskState> {
  await sleep(700);
  const title = String(formData.get("title"));
  if (title.toLowerCase() === "groceries")
    return { errors: { title: "That task already exists." } };
  attempts += 1;
  if (attempts % 2 === 1) return { error: "Could not reach the server. Try again." };
  return {};
}

// `useActionState` lives inside the Popup: its content is unmounted while the dialog is closed,
// so the next open starts with no error. Held by the component that renders `Dialog.Root`, the
// state would outlive the close and the next open would show the last errors on an empty form.
function NewTaskForm() {
  const [state, formAction] = useActionState(createTask, {});
  return (
    <Dialog.Form
      action={formAction}
      render={<Form.Root errors={state.errors} error={state.error} />}
      className="demo-dialog-form"
    >
      <Form.Error className="demo-form-error" />
      <Field.Root name="title" required className="demo-fieldset">
        <Field.Label className="demo-label">Title</Field.Label>
        <Field.Control autoComplete="off" className="demo-input" />
        <Field.Error className="demo-field-error" />
      </Field.Root>
      <div className="demo-dialog-actions">
        <Dialog.Close className="demo-button">Cancel</Dialog.Close>
        <Form.Submit className="demo-button demo-primary">
          {({ pending }) => (
            <>
              {pending && <span className="demo-spinner" aria-hidden />}
              Create
            </>
          )}
        </Form.Submit>
      </div>
    </Dialog.Form>
  );
}

export function FieldNewTask() {
  return (
    // `defaultOpen={false}` selects library mode, in which the Popup's content is unmounted
    // while closed (in JS-free mode it is always mounted).
    <Dialog.Root defaultOpen={false}>
      <Dialog.Trigger className="demo-button">New task</Dialog.Trigger>
      <Dialog.Popup className="demo-dialog">
        <Dialog.Title>New task</Dialog.Title>
        <Dialog.Description>
          The first save fails as if offline; Create again retries. &quot;Groceries&quot; is taken.
        </Dialog.Description>
        <NewTaskForm />
      </Dialog.Popup>
    </Dialog.Root>
  );
}
