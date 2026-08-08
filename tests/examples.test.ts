import { describe, expect, it, vi } from "vitest";
import { DebuggerEngine } from "../src/core/engine";
import { algorithmExamples } from "../src/examples";
import { parseTeachingComments, teachingNotesFromComments } from "../src/teaching";

describe("algorithm examples", () => {
  for (const example of algorithmExamples) {
    it(`introduces ${example.title} before its guided code steps`, () => {
      if (example.teachingNotes) {
        expect(example.code).not.toContain("/**");
        expect(example.teachingNotes[1]?.title).toBe("Problem");
        return;
      }
      const comments = parseTeachingComments(example.code);

      expect(comments[0]?.title).toBe("Problem");
      expect(comments[0]?.explanation).toContain("## How it works");
      expect(comments[0]?.explanation.length).toBeGreaterThan(180);
    });

    it(`executes ${example.title} to completion`, async () => {
      const onConsole = vi.fn();
      const engine = new DebuggerEngine(example.code, { onConsole });
      const result = await engine.advance("continue");

      expect(result.status, result.error?.message).toBe("complete");
      expect(onConsole).toHaveBeenCalled();
    });

    it(`explains every reachable line in ${example.title}`, async () => {
      const engine = new DebuggerEngine(example.code);
      const notes = example.teachingNotes ?? teachingNotesFromComments(example.code);
      let result = await engine.advance("into");

      for (let step = 0; step < 5000 && result.status === "paused"; step += 1) {
        const line = result.point?.range.startLine;
        expect(notes?.[line ?? -1], `Missing teaching note for ${example.id}:${line}`).toBeDefined();
        result = await engine.advance("into");
      }

      expect(result.status, result.error?.message).toBe("complete");
      expect(
        example.breakpoints.every(
          (line) =>
            Boolean(notes[line]?.question) &&
            notes[line]?.choices?.length === 3 &&
            notes[line]?.answer !== undefined,
        ),
      ).toBe(true);
    });
  }
});
