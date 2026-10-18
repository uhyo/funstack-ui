"use client";
import { Suspense, use, useState } from "react";
import { Slider } from "@funstack/ui/slider";
import { sleep } from "./fake-api.js";

const products = Array.from({ length: 40 }, (_, i) => ({
  name: `Product ${i + 1}`,
  price: ((i * 37) % 50) * 10,
}));
type Product = (typeof products)[number];
const cache = new Map<string, Promise<Product[]>>();

/** A pretend search that takes 300 ms per price range. */
function search(lo: number, hi: number): Promise<Product[]> {
  const key = `${lo}-${hi}`;
  let promise = cache.get(key);
  if (promise === undefined) {
    promise = sleep(300).then(() => products.filter((p) => p.price >= lo && p.price <= hi));
    cache.set(key, promise);
  }
  return promise;
}

function Results({ range: [lo = 0, hi = 0] }: { range: readonly number[] }) {
  const found = use(search(lo, hi));
  return (
    <>
      {found.length} products, from {found[0]?.name ?? "none"}
    </>
  );
}

// Controlled, two thumbs, a live filter. valueChangeAction adopts every step with setPrice in
// its synchronous prefix: a transition update. The results suspend for each range while the old
// ones stay on screen (dimmed through `pending`), and the thumbs never wait for them. Thumbs
// cannot cross: each input's native min / max are its neighbour's value plus one step.
export function SliderPrice() {
  const [price, setPrice] = useState<readonly number[]>([100, 300]);
  return (
    <Slider.Root
      className="demo-slider"
      value={price}
      min={0}
      max={500}
      step={10}
      minStepsBetweenThumbs={1}
      valueChangeAction={(next) => {
        setPrice(next);
      }}
      getAriaValueText={(v) => `${v} dollars`}
    >
      {({ pending }) => (
        <>
          <div className="demo-slider-head">
            <Slider.Label className="demo-slider-label">Price</Slider.Label>
            <Slider.Value>{({ values: [lo, hi] }) => `$${lo} – $${hi}`}</Slider.Value>
          </div>
          <Slider.Track className="demo-slider-track">
            <Slider.Indicator className="demo-slider-fill" />
            <Slider.Thumb index={0} aria-label="Minimum price" className="demo-slider-thumb" />
            <Slider.Thumb index={1} aria-label="Maximum price" className="demo-slider-thumb" />
          </Slider.Track>
          <p className="demo-slider-results" data-stale={pending ? "" : undefined}>
            <Suspense fallback="Searching…">
              <Results range={price} />
            </Suspense>
          </p>
        </>
      )}
    </Slider.Root>
  );
}
