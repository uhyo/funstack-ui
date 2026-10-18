// No "use client": a Server Component, and Meter.Root runs on the server with it. Lower is better
// (optimum 0): up to `low` the region is "optimum", up to `high` "suboptimum", above it
// "even-less-good". The track draws the zones from --meter-low / --meter-high, the fill is
// coloured by data-region, and getAriaValueText adds the words the colour carries. Function props
// go to the Root only: the parts are client components, and a Server Component cannot pass them
// a function.
import { Meter } from "@funstack/ui/meter";

const quota = 5;
const accounts = [
  { id: "personal", name: "Personal", used: 1.2 },
  { id: "team", name: "Team", used: 4.1 },
  { id: "archive", name: "Archive", used: 4.6 },
];

export function MeterStorage() {
  return (
    <div className="demo-stack">
      {accounts.map((account) => (
        <Meter.Root
          key={account.id}
          className="demo-meter"
          value={account.used}
          max={quota}
          low={quota * 0.7}
          high={quota * 0.9}
          optimum={0}
          locale="en-US"
          format={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }}
          getAriaValueText={(_, { formattedValue, region }) =>
            region === "even-less-good" ? `${formattedValue}, almost full` : formattedValue
          }
        >
          {/* The Root's children(state) runs on the server with the Root. A function passed to a
              part (Meter.Value children) would not: the parts are client components. */}
          {({ formattedValue, max }) => (
            <>
              <div className="demo-meter-head">
                <Meter.Label>{account.name} storage</Meter.Label>
                <Meter.Value>{`${formattedValue} of ${max} GB`}</Meter.Value>
              </div>
              <Meter.Track className="demo-meter-track">
                <Meter.Indicator className="demo-meter-fill" />
              </Meter.Track>
            </>
          )}
        </Meter.Root>
      ))}
    </div>
  );
}
