// No "use client": this file is a Server Component. The Accordion has no value props, so it runs
// in JS-free mode: the browser owns <details open>, `exclusive` becomes the native `name` group,
// and opening an item works before hydration (and with JavaScript off).
import { Accordion } from "@funstack/ui/accordion";

const faq = [
  {
    id: "what",
    question: "What is FUNSTACK UI?",
    answer:
      "A headless React component library built for Async React: transitions by default, action props, Suspense-native content.",
  },
  {
    id: "js",
    question: "Does this accordion need JavaScript?",
    answer:
      "No. It renders <details> and <summary>. Try your browser's find-in-page for the word zeppelin: the browser opens the matching item by itself.",
  },
  {
    id: "zeppelin",
    question: "Is anything hidden in here?",
    answer: "Only a zeppelin, to show that closed items stay searchable.",
  },
];

export function AccordionFaq() {
  return (
    <Accordion.Root exclusive className="demo-accordion">
      {faq.map((item, index) => (
        <Accordion.Item
          key={item.id}
          value={item.id}
          defaultOpen={index === 0}
          className="demo-accordion-item"
        >
          <Accordion.Trigger className="demo-accordion-trigger">
            <h4>{item.question}</h4>
          </Accordion.Trigger>
          <Accordion.Panel className="demo-accordion-panel">
            <p>{item.answer}</p>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
