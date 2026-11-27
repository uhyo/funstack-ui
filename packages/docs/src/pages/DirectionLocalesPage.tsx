import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { DocPage } from "../components/DocPage.js";
import { Table } from "../components/Tables.js";
import { GITHUB_URL } from "../navigation.js";

const issue = (n: number) => `${GITHUB_URL}/issues/${n}`;

export function DirectionLocalesPage() {
  return (
    <DocPage
      title="Direction and locales"
      description="Right-to-left pages and number formatting in FUNSTACK UI: dir is the only direction switch (no DirectionProvider), which keys mirror, the engine differences, OTPField's ltr default, and the locale prop per Root (no LocaleProvider) with SSR recipes."
    >
      <p className="page-intro">
        FUNSTACK UI has no <code>DirectionProvider</code> and no <code>LocaleProvider</code>.
        Direction comes from the page, the way the browser reads it; a locale is a plain prop on the
        Root of each component that formats numbers.
      </p>

      <h3 id="direction">Direction</h3>
      <p>
        <strong>
          <code>dir</code> is the only switch.
        </strong>{" "}
        Set it where the platform expects it: <code>{'<html dir="rtl">'}</code>, a container, or a
        part itself (every part passes native attributes through, so{" "}
        <code>{'<Tabs.List dir="rtl">'}</code> works). Each component reads the computed CSS{" "}
        <code>direction</code> of the relevant element (the table below) when a key is pressed or a
        gesture starts, so nothing is needed at render and Server Components and the server HTML are
        unaffected.
      </p>
      <CodeBlock>{`// <html lang="ar" dir="rtl"> in your document, then no setup:
<Tabs.Root defaultValue="a">
  <Tabs.List>…</Tabs.List> {/* ArrowLeft moves to the next tab */}
</Tabs.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>Why no provider.</strong> A provider would be a second source of truth next to{" "}
          <code>dir</code>, the attribute the browser already uses for layout, logical properties,{" "}
          <code>:dir()</code> and anchor positioning. Libraries that have one ask you to set both,
          and when the two disagree the arrow keys and the layout point different ways. Reading the
          CSS cannot disagree with the layout, and a page with <code>{'<html dir="rtl">'}</code>{" "}
          needs no setup at all.
        </li>
        <li>
          <strong>Direction islands work.</strong> An RTL block inside an LTR page (a quoted Arabic
          form, a Hebrew sidebar), or the reverse, is handled per component, because each reads its
          own element. Nothing has to be nested to match the markup.
        </li>
        <li>
          Placement of popups follows direction in CSS: <code>side="inline-start"</code> /{" "}
          <code>"inline-end"</code> and <code>align="start"</code> / <code>"end"</code> use
          anchor-positioning keywords that resolve against the popup's direction. Drawer's{" "}
          <code>side</code> takes <code>"inline-start"</code> / <code>"inline-end"</code> too.
        </li>
        <li>
          A locale never sets the direction: <code>{'locale="ar"'}</code> on a NumberField changes
          its digits and separators, not its layout.
        </li>
      </ul>

      <h4 id="what-mirrors">What mirrors</h4>
      <p>
        <strong>Only ArrowLeft and ArrowRight in a horizontal orientation swap.</strong> ArrowUp /
        ArrowDown, Home / End, PageUp / PageDown and every vertical orientation do the same under
        RTL as under LTR. <code>writing-mode</code> is not read.
      </p>
      <Table
        head={["Component", "What follows direction", "Read from"]}
        rows={[
          [
            "[Tabs](/components/tabs)",
            "ArrowLeft / ArrowRight between tabs (horizontal list)",
            "the List",
          ],
          [
            "[ToggleGroup](/components/toggle-group), [Toolbar](/components/toolbar)",
            "ArrowLeft / ArrowRight between items (horizontal)",
            "the Root",
          ],
          [
            "[Slider](/components/slider)",
            "ArrowLeft / ArrowRight follow the mirrored track (Right decreases); the value under the pointer",
            "the thumb's input; the Track",
          ],
          [
            "[Menu](/components/menu)",
            "the arrow that opens and closes a submenu (the inline-end one); the open key of a Trigger in a vertical Toolbar; which edge of a menu opened at a point sits at the pointer; the wheel hand-off of a horizontal scroller",
            "the popup or its parent popup; the Trigger; the scroller",
          ],
          [
            "[Combobox](/components/combobox) `multiple`",
            "the inline-start arrow from the input to the chips, and arrows between chips",
            "the input; the chip",
          ],
          [
            "[Drawer](/components/drawer)",
            "which way an `inline-start` / `inline-end` drawer swipes closed",
            "the dialog",
          ],
          [
            "Tooltip, Popover, HoverCard, Menu, Select, Combobox, MultiSelect",
            "logical sides and alignment; `data-side` / `data-align` report where the popup is",
            "CSS anchor positioning",
          ],
          [
            "[RadioGroup](/components/radio-group)",
            "arrows between radios (native; not in Safari, below)",
            "the browser",
          ],
          [
            "[OTPField](/components/otp-field)",
            "nothing: the Root is `ltr` by default (below)",
            "–",
          ],
          ["Accordion, NumberField", "nothing: vertical keys only", "–"],
        ]}
      />

      <h4 id="engine-differences">Engine differences</h4>
      <ul>
        <li>
          <strong>RadioGroup in Safari, by design.</strong> Radio arrows are the browser's own, and
          WebKit neither mirrors ArrowLeft / ArrowRight under RTL nor wraps at the ends: Right and
          Down always go to the next radio in document order. A FUNSTACK radio group behaves like
          every native radio group in Safari; the library adds no key handler (
          <a href="/components/radio-group#keyboard-and-aria">RadioGroup</a>). Slider is the
          exception, because there the value moved against the drawn track.
        </li>
        <li>
          <strong>Firefox misplaces popups in a direction island.</strong> When a popup's parent box
          has another direction than the root element (an RTL block in an LTR page, or the reverse),
          Firefox mirrors the inline offset of its anchored position, physical sides included, so
          the popup lands away from its trigger (<a href={issue(89)}>#89</a>, Mozilla bug 2019601).
          Chromium and Safari place it correctly, a page whose <code>{"<html dir>"}</code> matches
          is unaffected, and the library ships no workaround.
        </li>
      </ul>

      <h4 id="otp-field">OTPField is left to right</h4>
      <p>
        A one-time code is read left to right in every locale, so <code>OTPField.Root</code> renders{" "}
        <code>dir="ltr"</code> unless you pass <code>dir</code>: inside an RTL page Slot 0 stays the
        leftmost box and ArrowLeft moves to the previous character. The label and the messages
        outside the Root follow the page. Without the attribute the boxes would mirror while the
        input's text would not, and the engines disagree on the arrow keys there. See{" "}
        <a href="/components/otp-field#right-to-left-pages">OTPField</a>.
      </p>

      <h3 id="locale">Locales</h3>
      <p>
        Components that format or parse numbers take a <code>locale</code> prop on their Root:{" "}
        <a href="/components/number-field">NumberField</a>,{" "}
        <a href="/components/progress">Progress</a> and <a href="/components/meter">Meter</a>. The
        type is <code>string | readonly string[]</code>, what the <code>Intl</code> constructors
        take (a list is a preference order). The parts get the formatter from the Root.
      </p>
      <ul>
        <li>
          <strong>The default is the runtime's locale</strong>, on the server and in the browser.
          That suits a client-only app.
        </li>
        <li>
          <strong>Pass it when the page is server-rendered.</strong> The server's locale and the
          browser's can differ, and the formatted text would then not match at hydration.
          NumberField warns in development when <code>{"<html lang>"}</code> names another language
          and no <code>locale</code> was given.
        </li>
        <li>
          The library never reads <code>navigator.language</code> and never derives the locale from{" "}
          <code>lang</code>.
        </li>
      </ul>

      <h4 id="why-no-locale-provider">Why there is no LocaleProvider</h4>
      <p>
        <code>Progress.Root</code> and <code>Meter.Root</code> have no <code>"use client"</code>{" "}
        directive, so a Server Component renders them once, on the server. A context cannot reach
        them there, so a provider would silently not apply to them. And an app that localises
        already has a locale source, its i18n library; a second provider would have to be kept in
        step with it. The question is reopened by the first date or time component.
      </p>

      <h4 id="from-an-i18n-library">Recipe: the locale from your i18n library</h4>
      <p>
        Wrap the Root once in a client component that reads the locale from your i18n library, and
        use the wrapper everywhere:
      </p>
      <CodeBlock>{`"use client";
import { NumberField } from "@funstack/ui/number-field";
import type { ComponentProps } from "react";
import { useLocale } from "./i18n"; // your i18n library's hook

export function NumberFieldRoot(props: ComponentProps<typeof NumberField.Root>) {
  const locale = useLocale();
  return <NumberField.Root locale={locale} {...props} />;
}`}</CodeBlock>

      <h4 id="from-a-server-component">Recipe: from a Server Component</h4>
      <p>
        <code>locale</code> is plain data, so a Server Component passes it directly. Progress and
        Meter then format on the server, with nothing to mismatch:
      </p>
      <CodeBlock>{`import { Progress } from "@funstack/ui/progress";
import { getLocale } from "./i18n/server"; // however your server knows the request's locale

export async function UploadStatus({ done }: { done: number }) {
  const locale = await getLocale(); // for example "ar-EG" or ["de-CH", "de"]
  return (
    <Progress.Root value={done} locale={locale} aria-label="Upload">
      <Progress.Value />
      <Progress.Track><Progress.Indicator /></Progress.Track>
    </Progress.Root>
  );
}`}</CodeBlock>

      <h3 id="built-in-strings">Built-in strings</h3>
      <p>
        A few parts have an English default text, each with its own override; there is no strings
        provider either.
      </p>
      <Table
        head={["Component", "Default", "Override"]}
        rows={[
          [
            "[Combobox](/components/combobox#props)",
            '`"No results"`, `"1 result"`, `"N results"`; `"Japan removed"` with `multiple`',
            "`announce`, `announceRemoved` on the Root",
          ],
          [
            "[Toast](/components/toast#props)",
            '`"Notifications (F8)"`, the Viewport\'s name',
            "`aria-label` on `Toast.Viewport`",
          ],
          [
            "[NumberField](/components/number-field#props)",
            '`"Increase"` / `"Decrease"`, the buttons\' names',
            "`aria-label` on `Increment` / `Decrement`",
          ],
        ]}
      />
      <Callout title="Not formatted by the library">
        <p>
          Slider's <code>aria-valuetext</code> and Combobox filtering are yours: format and compare
          with <code>Intl</code> in your own function.
        </p>
      </Callout>
    </DocPage>
  );
}
