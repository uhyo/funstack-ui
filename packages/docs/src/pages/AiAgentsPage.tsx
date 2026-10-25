import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { DocPage } from "../components/DocPage.js";
import { Table } from "../components/Tables.js";

export function AiAgentsPage() {
  return (
    <DocPage
      title="Using with AI agents"
      description="Give a coding agent FUNSTACK UI knowledge: install the funstack-ui-knowledge skill from the npm package, or point the agent at the Markdown docs bundled in the package and published as llms.txt."
    >
      <p className="page-intro">
        FUNSTACK UI's API differs from other headless libraries: action props instead of{" "}
        <code>onChange</code>, <code>render</code> instead of <code>asChild</code>, transitions you
        do not start yourself. An agent that guesses from other libraries gets these wrong. Give it
        the documentation instead.
      </p>

      <h3 id="skill">Install the agent skill</h3>
      <p>
        An <a href="https://agentskills.io">agent skill</a> is a Markdown file that an agent loads
        when a task needs it. <code>@funstack/ui</code> ships one, named{" "}
        <code>funstack-ui-knowledge</code>, and an installer that copies it into your project. Run
        it in your project's root, with <code>@funstack/ui</code> installed:
      </p>
      <CodeBlock language="bash">{`npx -p @funstack/ui@alpha funstack-ui-skill-installer
# or
pnpm dlx --package @funstack/ui@alpha funstack-ui-skill-installer
# or
yarn dlx -p @funstack/ui@alpha funstack-ui-skill-installer`}</CodeBlock>
      <p>
        The installer asks which agent you use (Claude Code, Codex, GitHub Copilot, Cursor and
        others, or a custom path) and copies the skill into that agent's skills directory, for
        example <code>.claude/skills/funstack-ui-knowledge/</code>. In a script or CI, where there
        is no terminal to ask in, it reads the target directory from <code>SKILL_INSTALL_PATH</code>{" "}
        instead:
      </p>
      <CodeBlock language="bash">{`SKILL_INSTALL_PATH=./.claude/skills npx -p @funstack/ui@alpha funstack-ui-skill-installer`}</CodeBlock>
      <p>
        In an interactive terminal the variable is ignored and the prompt appears; add{" "}
        <code>&lt; /dev/null</code> to the command to use the variable there.
      </p>
      <p>The skill is short, so the agent can load it whole. It contains:</p>
      <ul>
        <li>
          The mental model: action props, optimistic and pending state, Suspense, transitions.
        </li>
        <li>
          The mistakes agents make most often, such as writing <code>onValueChange</code> or
          wrapping actions in <code>startTransition</code>.
        </li>
        <li>A one-line index of every component, with its import path and parts.</li>
        <li>A pointer to the full documentation bundled in the package (below).</li>
      </ul>
      <p>
        Re-run the installer after upgrading <code>@funstack/ui</code> to update the skill. Commit
        the copied files if your team shares the agent setup.
      </p>

      <h3 id="bundled-docs">Docs in the package</h3>
      <p>
        The npm package contains this whole site as Markdown, matching the installed version. The
        skill points the agent at its index:
      </p>
      <CodeBlock language="bash">{`node_modules/@funstack/ui/dist/docs/index.md`}</CodeBlock>
      <p>
        You can also point an agent at this file directly, without the skill. Because it comes from
        the installed package, it does not drift from the code the agent is writing against.
      </p>

      <h3 id="llms-txt">Docs on the web</h3>
      <p>The same Markdown is published on this site:</p>
      <Table
        head={["URL", "Contents"]}
        rows={[
          [
            "`https://ui.funstack.work/llms.txt`",
            "An index of every page with a one-line description, in the [llms.txt](https://llmstxt.org) format.",
          ],
          ["`https://ui.funstack.work/llms-full.txt`", "Every page in one file, in sidebar order."],
          [
            "Any page URL plus `.md`",
            "That page as Markdown, for example `https://ui.funstack.work/components/dialog.md`.",
          ],
        ]}
      />
      <Callout title="Which version?">
        <p>
          The site documents the latest release. If your project pins an older alpha, prefer the
          docs in <code>node_modules</code>.
        </p>
      </Callout>
    </DocPage>
  );
}
