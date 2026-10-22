"use client";
import { startTransition, useState } from "react";
import { Menu } from "@funstack/ui/menu";
import { fakeSave } from "./fake-api.js";

interface File {
  readonly id: string;
  readonly name: string;
  readonly size: string;
}

const initialFiles: readonly File[] = [
  { id: "1", name: "Report.pdf", size: "1.2 MB" },
  { id: "2", name: "Budget.xlsx", size: "84 KB" },
  { id: "3", name: "Notes.md", size: "3 KB" },
];

// One Menu.Root per row with two ways in: the "⋯" button opens the menu anchored below it, a
// right-click anywhere on the row (or Shift+F10 on the button, or a long-press on touch) opens
// the same menu at the pointer. The button is also the required alternate path: a context menu
// is never the only way to an action. Archive is a fake 1.2 s server call: the item shows
// "Archiving…" (data-pending) and the menu closes when it settles.
export function ContextMenuFiles() {
  const [files, setFiles] = useState(initialFiles);
  const [log, setLog] = useState("Right-click a row, or use its ⋯ button.");
  const remove = (id: string) =>
    startTransition(() => setFiles((f) => f.filter((x) => x.id !== id)));
  const rename = (id: string) =>
    startTransition(() =>
      setFiles((f) => f.map((x) => (x.id === id ? { ...x, name: `Renamed ${x.name}` } : x))),
    );

  return (
    <div className="demo-stack">
      <table className="demo-files">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Size</th>
            <th scope="col">
              <span className="demo-cm-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <Menu.Root
              key={file.id}
              openChangeAction={(open, { reason }) => {
                if (open) setLog(`Opened the menu of ${file.name} (${reason}).`);
              }}
            >
              <Menu.ContextTrigger render={<tr className="demo-file-row" />}>
                <td>{file.name}</td>
                <td>{file.size}</td>
                <td>
                  <Menu.Trigger
                    className="demo-icon-button"
                    aria-label={`Actions for ${file.name}`}
                  >
                    {({ pending }) =>
                      pending ? <span className="demo-spinner" aria-hidden /> : "⋯"
                    }
                  </Menu.Trigger>
                  {/* In a table the Popup goes inside a cell: a <div> cannot sit next to a <tr>. */}
                  <Menu.Popup className="demo-menu" align="end">
                    <Menu.Item action={() => rename(file.id)}>Rename</Menu.Item>
                    <Menu.Item
                      action={async () => {
                        await fakeSave("the archive", { ms: 1200 });
                        remove(file.id);
                        startTransition(() => setLog(`Archived ${file.name}.`));
                      }}
                    >
                      {({ pending }) => (pending ? "Archiving…" : "Archive")}
                    </Menu.Item>
                    <Menu.Separator />
                    <Menu.Item className="demo-menu-danger" action={() => remove(file.id)}>
                      Delete
                    </Menu.Item>
                  </Menu.Popup>
                </td>
              </Menu.ContextTrigger>
            </Menu.Root>
          ))}
        </tbody>
      </table>
      {files.length === 0 && (
        <button type="button" className="demo-button" onClick={() => setFiles(initialFiles)}>
          Restore the files
        </button>
      )}
      <p className="demo-readout">{log}</p>
    </div>
  );
}
