import { hydrateRoot, createRoot } from "react-dom/client";
import { App, log } from "./app.jsx";
window.__errors = [];
const origErr = console.error;
console.error = (...a) => { window.__errors.push(a.map(String).join(" ").slice(0, 300)); origErr(...a); };
window.mount = (mode, variant) => {
  const el = document.getElementById("root");
  if (mode === "hydrate") hydrateRoot(el, <App variant={variant} />, { onRecoverableError: (e) => window.__errors.push("recoverable: " + String(e).slice(0, 200)) });
  else createRoot(el).render(<App variant={variant} />);
};
window.getLog = () => log;
