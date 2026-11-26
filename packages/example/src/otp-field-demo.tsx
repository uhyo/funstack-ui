import { useActionState, useRef, useState } from "react";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import { OTPField } from "@funstack/ui/otp-field";
import { Separator } from "@funstack/ui/separator";
import { Demo } from "./shared/Demo.js";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary.js";
import { sleep } from "./shared/fake-backend.js";
import "./otp-field-demo.css";

const SIX = [0, 1, 2, 3, 4, 5];

function Slots({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <OTPField.Slot key={i} index={i} className="otp-slot" />
      ))}
    </>
  );
}

/** completeAction with a failing server check; a controlled parent clears the code. */
function Verify() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const current = useRef("");
  return (
    <section>
      <h3>Verify (completeAction)</h3>
      <label htmlFor="otp-verify">Verification code (123456 is right)</label>
      <OTPField.Root
        length={6}
        value={code}
        onValueChange={(next, details) => {
          current.current = next;
          setCode(next);
          setMessage("");
          setLog((l) => [...l.slice(-4), `onValueChange("${next}", ${details.reason})`]);
        }}
        completeAction={async (entered, details) => {
          setLog((l) => [...l.slice(-4), `completeAction("${entered}", ${details.reason})`]);
          await sleep(900);
          if (entered !== current.current) return;
          if (entered === "123456") {
            setMessage("Verified.");
            return;
          }
          setMessage("Wrong code. Try again.");
          current.current = "";
          setCode("");
        }}
        className="otp"
      >
        <OTPField.Input id="otp-verify" aria-describedby="otp-verify-msg" className="otp-input" />
        <OTPField.Slot index={0} className="otp-slot" />
        <OTPField.Slot index={1} className="otp-slot" />
        <OTPField.Slot index={2} className="otp-slot" />
        <Separator decorative orientation="vertical" className="otp-dash" />
        <OTPField.Slot index={3} className="otp-slot" />
        <OTPField.Slot index={4} className="otp-slot" />
        <OTPField.Slot index={5} className="otp-slot" />
      </OTPField.Root>
      <p id="otp-verify-msg" role="status">
        {message}
      </p>
      <pre className="otp-log">{log.join("\n")}</pre>
    </section>
  );
}

interface SignInState {
  readonly errors?: Record<string, string>;
  readonly ok?: boolean;
}

/** submitOnComplete inside a Form: the server error comes back on the Field. */
function AutoSubmit() {
  const [state, formAction] = useActionState(
    async (_prev: SignInState, formData: FormData): Promise<SignInState> => {
      await sleep(800);
      return formData.get("code") === "123456"
        ? { ok: true }
        : { errors: { code: "That code has expired." } };
    },
    {},
  );
  return (
    <section>
      <h3>Auto-submit (submitOnComplete)</h3>
      <Form.Root action={formAction} errors={state.errors} className="otp-form">
        <Field.Root name="code" required>
          <Field.Label>Sign-in code</Field.Label>
          <Field.Description>6 digits. It is submitted when complete.</Field.Description>
          <OTPField.Root length={6} submitOnComplete className="otp">
            <OTPField.Input className="otp-input" title="6 digits" />
            {SIX.map((i) => (
              <OTPField.Slot key={i} index={i} className="otp-slot" />
            ))}
          </OTPField.Root>
          <Field.Error className="otp-error" />
        </Field.Root>
        <Form.Submit>{({ pending }) => (pending ? "Verifying…" : "Verify")}</Form.Submit>
        {state.ok === true && <p role="status">Signed in.</p>}
      </Form.Root>
    </section>
  );
}

/** Letters, a rejected action, and the slot children function. */
function Others() {
  return (
    <section>
      <h3>Alphanumeric, masked, rejecting</h3>
      <label htmlFor="otp-alnum">Backup code (letters and digits, try paste "ab-12-cd")</label>
      <OTPField.Root length={6} charset="alphanumeric" className="otp">
        <OTPField.Input id="otp-alnum" className="otp-input" />
        <Slots />
      </OTPField.Root>
      <label htmlFor="otp-pin">PIN (masked, not a one-time code)</label>
      <OTPField.Root length={4} className="otp">
        <OTPField.Input id="otp-pin" autoComplete="off" className="otp-input" />
        {[0, 1, 2, 3].map((i) => (
          <OTPField.Slot key={i} index={i} className="otp-slot">
            {({ filled }) => (filled ? "•" : null)}
          </OTPField.Slot>
        ))}
      </OTPField.Root>
      <DemoErrorBoundary>
        <label htmlFor="otp-reject">A completeAction that rejects (Error Boundary)</label>
        <OTPField.Root
          length={4}
          completeAction={async () => {
            await sleep(500);
            throw new Error("The verification service is down.");
          }}
          className="otp"
        >
          <OTPField.Input id="otp-reject" className="otp-input" />
          <Slots count={4} />
        </OTPField.Root>
      </DemoErrorBoundary>
    </section>
  );
}

export function OTPFieldDemo() {
  return (
    <Demo title="OTPField">
      <Verify />
      <AutoSubmit />
      <Others />
    </Demo>
  );
}
