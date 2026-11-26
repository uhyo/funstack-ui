"use client";
import { startTransition, useRef, useState } from "react";
import { OTPField } from "@funstack/ui/otp-field";
import { sleep } from "./fake-api.js";

const SLOTS = [0, 1, 2, 3, 4, 5];

// A pretend server check. A wrong code is not an error: it resolves with a message.
async function checkCode(code: string): Promise<{ ok: true } | { ok: false; message: string }> {
  await sleep(900);
  return code === "123456"
    ? { ok: true }
    : { ok: false, message: "That code is not right. Check the message and try again." };
}

// Try a wrong code: the field pends while the server checks, then clears with a message. Type
// 123456: verified. Paste "123 456" or "123-456" too; the filter keeps the digits. The check runs
// once per completed code, and again when the same code is entered again.
export function OTPFieldVerify() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  // The latest text, for the check to compare against after its await.
  const current = useRef("");

  if (verified) {
    return (
      <div className="demo-otp-done">
        <p className="demo-readout">Verified. Welcome back.</p>
        <button
          type="button"
          className="demo-button"
          onClick={() => {
            setVerified(false);
            current.current = "";
            setCode("");
          }}
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="demo-otp-form">
      <label htmlFor="verify-code" className="demo-label">
        Verification code
      </label>
      <p id="verify-hint" className="demo-description">
        Enter the 6-digit code we sent to your phone (try 123456).
      </p>
      <OTPField.Root
        length={6}
        value={code}
        onValueChange={(next) => {
          current.current = next;
          setCode(next);
          setMessage(null);
        }}
        completeAction={async (entered) => {
          const result = await checkCode(entered);
          // The user may have edited the code meanwhile: act on the current one only.
          if (entered !== current.current) return;
          if (result.ok) {
            startTransition(() => setVerified(true));
            return;
          }
          setMessage(result.message);
          current.current = "";
          setCode("");
        }}
        className="demo-otp"
      >
        <OTPField.Input
          id="verify-code"
          aria-describedby="verify-hint verify-message"
          className="demo-otp-input"
        />
        {SLOTS.map((i) => (
          <OTPField.Slot key={i} index={i} className="demo-otp-slot" />
        ))}
      </OTPField.Root>
      <p id="verify-message" role="status" className="demo-field-error">
        {message}
      </p>
    </div>
  );
}
