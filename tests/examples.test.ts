import { describe, expect, it, vi } from "vitest";
import { DebuggerEngine } from "../src/core/engine";
import { algorithmExamples } from "../src/examples";

describe("algorithm examples", () => {
  for (const example of algorithmExamples) {
    it(`executes ${example.title} to completion`, async () => {
      const onConsole = vi.fn();
      const engine = new DebuggerEngine(example.code, { onConsole });
      const result = await engine.advance("continue");

      expect(result.status, result.error?.message).toBe("complete");
      expect(onConsole).toHaveBeenCalled();
    });
  }
});
