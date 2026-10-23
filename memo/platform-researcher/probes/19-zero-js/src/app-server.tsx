import { cache, useId, type ReactNode } from "react";

// 1. useId in Server Components
function IdProbe({ label }: { label: string }) {
  const id = useId();
  return <p data-probe="useid" data-label={label} id={id}>{id}</p>;
}

// 2. Children-function Root: a directive-free Root hands ids to directive-free parts.
function TipRoot({ children }: { children: (ids: { trigger: string; popup: string }) => ReactNode }) {
  const id = useId();
  return <>{children({ trigger: `${id}t`, popup: `${id}p` })}</>;
}

// 3. cache()-scoped mutable "server context": Root writes, descendants read.
const scope = cache(() => ({ name: null as string | null, log: [] as string[] }));
function GroupRoot({ name, children }: { name: string; children: ReactNode }) {
  scope().name = name;
  scope().log.push(`root:${name}`);
  return <section data-group={name}>{children}</section>;
}
function GroupItem({ label }: { label: string }) {
  const s = scope();
  s.log.push(`item:${label}:${s.name}`);
  return <details name={s.name ?? undefined}><summary>{label}</summary></details>;
}
async function AsyncGroupItem({ label }: { label: string }) {
  await new Promise((r) => setTimeout(r, 10));
  const s = scope();
  s.log.push(`async-item:${label}:${s.name}`);
  return <details name={s.name ?? undefined} data-async=""><summary>{label}</summary></details>;
}
function Log() {
  // Rendered last; reads the log at its own render time.
  return <pre data-probe="log">{JSON.stringify(scope().log)}</pre>;
}
async function LateLog() {
  await new Promise((r) => setTimeout(r, 50));
  return <pre data-probe="latelog">{JSON.stringify(scope().log)}</pre>;
}

// 4. cache() identity across a request
const counter = { n: 0 };
const perRequest = cache(() => ++counter.n);
function CacheProbe() {
  return <p data-probe="cache">{perRequest()},{perRequest()}</p>;
}

export default function App() {
  return (
    <main>
      <IdProbe label="a" />
      <IdProbe label="b" />
      <TipRoot>
        {(ids) => (
          <>
            <button id={ids.trigger} aria-describedby={ids.popup} interestfor={ids.popup}>Save</button>
            <div id={ids.popup} popover="hint" role="tooltip">Saves</div>
          </>
        )}
      </TipRoot>
      <GroupRoot name="g1">
        <GroupItem label="1a" />
        <AsyncGroupItem label="1b" />
        <GroupItem label="1c" />
      </GroupRoot>
      <GroupRoot name="g2">
        <GroupItem label="2a" />
      </GroupRoot>
      <CacheProbe />
      <Log />
      <LateLog />
    </main>
  );
}
