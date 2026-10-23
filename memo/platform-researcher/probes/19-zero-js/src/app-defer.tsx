import { Suspense, useId } from "react";
import { defer } from "@funstack/static/server";
function IdProbe({ label }: { label: string }) {
  const id = useId();
  return <p data-label={label} id={id}>{id}</p>;
}
function Deferred() {
  return <section><IdProbe label="deferred-1" /><IdProbe label="deferred-2" /></section>;
}
export default function App() {
  return (
    <main>
      <IdProbe label="main-1" />
      <Suspense fallback={<p>loading</p>}>{defer(<Deferred />, { name: "Deferred" })}</Suspense>
      <IdProbe label="main-2" />
    </main>
  );
}
