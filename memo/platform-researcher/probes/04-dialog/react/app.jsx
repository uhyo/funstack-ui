import { useState, startTransition } from "react";
export const log = (globalThis.__log ??= []);
export function App({ variant }) {
  const [n, setN] = useState(0);
  return (
    <div>
      <button id="open" commandfor="d" command="show-modal">open</button>
      <button id="bump" onClick={() => setN(n + 1)}>bump {n}</button>
      <dialog
        id="d"
        onToggle={(e) => log.push(`onToggle:${e.nativeEvent.newState}`)}
        onBeforeToggle={(e) => log.push(`onBeforeToggle:${e.nativeEvent.newState}`)}
        onCancel={() => log.push("onCancel")}
        onClose={(e) => log.push(`onClose:${e.currentTarget.returnValue}`)}
        {...(variant === "openProp" ? { open: n % 2 === 1 } : {})}
      >
        {variant === "autofocus" ? <><button id="first">first</button><input id="af" autofocus="" /></> : null}
        {variant === "autoFocusReact" ? <><button id="first">first</button><input id="af" autoFocus /></> : null}
        <form method="dialog" action={variant === "formAction" ? async (fd) => { log.push("action:" + fd.get("x")); } : undefined}>
          <input name="x" defaultValue="1" />
          <button id="ok" value="ok">OK</button>
        </form>
        <button id="rc" commandfor="d" command="request-close" value="rc">rc</button>
      </dialog>
    </div>
  );
}
