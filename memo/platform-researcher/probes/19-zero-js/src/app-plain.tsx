// Hand-written directive-free markup: what a directive-free Accordion would emit.
export default function App() {
  return (
    <main>
      <details name="faq" open><summary>One</summary><div>A</div></details>
      <details name="faq"><summary>Two</summary><div>B</div></details>
    </main>
  );
}
