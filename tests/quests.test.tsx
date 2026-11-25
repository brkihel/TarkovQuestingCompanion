// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SettingsProvider } from "../src/settings";
import { QuestPanel } from "../src/components/QuestPanel";
import { useQuestProgress } from "../src/lib/useQuestProgress";
import type { Task } from "../src/lib/tarkovApi";
import { useState } from "react";

afterEach(() => { cleanup(); localStorage.clear(); });

const tasks = [{ id: "t", name: "Find the radio", minPlayerLevel: 4, kappaRequired: true, trader: { name: "Prapor" }, taskRequirements: [], objectives: [
  { id: "o", type: "visit", description: "Visit the radio tower", optional: false, maps: [{ normalizedName: "customs" }], zones: [] },
] }] as unknown as Task[];

it("searches tasks without coordinates and updates completion", () => {
  function Harness() {
    const [selected, setSelected] = useState(new Set<string>());
    const { completed, toggle } = useQuestProgress("regular");
    return <QuestPanel tasks={tasks} config={{ key: "customs" } as never} markers={[]} selected={selected} completed={completed} guides={{}} player={null}
      onToggle={(id) => setSelected(new Set([id]))} onComplete={toggle} onFocus={() => {}} onGuide={() => {}} />;
  }
  render(<SettingsProvider><Harness /></SettingsProvider>);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "unmatched" } });
  expect(screen.queryByText("Find the radio")).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "radio" } });
  fireEvent.click(screen.getByText("Find the radio"));
  expect(screen.getByText("No map coordinates available.")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Visit the radio tower"));
  expect(screen.queryByText("Find the radio")).toBeNull();
  fireEvent.click(screen.getByLabelText("Hide completed"));
  expect(screen.getByText("Find the radio")).toBeTruthy();
});

it("keeps objective progress isolated between game modes and across remounts", () => {
  function Harness() {
    const [mode, setMode] = useState<"regular" | "pve">("regular");
    const { completed, toggle } = useQuestProgress(mode);
    return <><button onClick={() => setMode(mode === "regular" ? "pve" : "regular")}>Switch</button>
      <button onClick={() => toggle("t:o")}>Complete</button><span>{mode}:{completed.size}</span></>;
  }
  const view = render(<Harness />);
  fireEvent.click(screen.getByText("Complete"));
  expect(screen.getByText("regular:1")).toBeTruthy();
  fireEvent.click(screen.getByText("Switch"));
  expect(screen.getByText("pve:0")).toBeTruthy();
  view.unmount(); render(<Harness />);
  expect(screen.getByText("regular:1")).toBeTruthy();
});
