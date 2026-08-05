import { describe, expect, it, vi } from "vitest";
import { DebuggerEngine } from "../src/core/engine";

const functionSource = `function add(a: number, b: number): number {
  const total = a + b;
  return total;
}

const result = add(2, 3);
const doubled = result * 2;`;

describe("DebuggerEngine", () => {
  it("steps into, over, and out of user functions", async () => {
    const engine = new DebuggerEngine(functionSource);

    const declaration = await engine.advance("into");
    expect(declaration.point?.range.startLine).toBe(1);
    expect(declaration.point?.nodeType).toBe("FunctionDeclaration");

    const callSite = await engine.advance("over");
    expect(callSite.point?.range.startLine).toBe(6);
    expect(callSite.point?.frameDepth).toBe(0);

    const functionBody = await engine.advance("into");
    expect(functionBody.point?.range.startLine).toBe(2);
    expect(functionBody.point?.frameDepth).toBe(1);
    expect(functionBody.point?.callStack.map((frame) => frame.name)).toEqual([
      "add",
      "<module>",
    ]);
    expect(
      functionBody.point?.scopes[0]?.entries.map(({ name, value }) => ({
        name,
        value,
      })),
    ).toEqual(
      expect.arrayContaining([
        { name: "a", value: 2 },
        { name: "b", value: 3 },
      ]),
    );

    const returnStatement = await engine.advance("over");
    expect(returnStatement.point?.range.startLine).toBe(3);

    const caller = await engine.advance("out");
    expect(caller.point?.range.startLine).toBe(7);
    expect(caller.point?.frameDepth).toBe(0);
    expect(
      caller.point?.scopes
        .flatMap((scope) => scope.entries)
        .find((entry) => entry.name === "result")?.value,
    ).toBe(5);
  });

  it("continues to breakpoints in deeper call frames", async () => {
    const engine = new DebuggerEngine(functionSource, { breakpoints: [3] });
    await engine.advance("into");

    const paused = await engine.advance("continue");

    expect(paused.status).toBe("paused");
    expect(paused.point?.range.startLine).toBe(3);
    expect(paused.point?.callStack[0]?.name).toBe("add");
  });

  it("tracks block state across a TypeScript for-of loop", async () => {
    const engine = new DebuggerEngine(`interface Item { value: number }
const items: Item[] = [{ value: 2 }, { value: 4 }];
let total = 0;
for (const item of items) {
  total += item.value;
}
console.log(total);`);
    const log = vi.fn();
    const observed = new DebuggerEngine(
      `const values: number[] = [2, 4];
let total = 0;
for (const value of values) {
  total += value;
}
console.log(total);`,
      { onConsole: log },
    );

    await observed.advance("into");
    const completed = await observed.advance("continue");

    expect(completed.status).toBe("complete");
    expect(log).toHaveBeenCalledWith({ id: 1, level: "log", values: [6] });
    expect(engine.snapshot.status).toBe("ready");
  });

  it("reports parse and runtime errors", async () => {
    expect(() => new DebuggerEngine("const = 1")).toThrow();

    const engine = new DebuggerEngine("const value = missingName;");
    await engine.advance("into");
    const failed = await engine.advance("into");

    expect(failed.status).toBe("error");
    expect(failed.error?.message).toContain("missingName is not defined");
  });

  it("blocks constructor-chain access to the host environment", async () => {
    const engine = new DebuggerEngine(
      'const host = [].constructor.constructor("return globalThis")();',
    );
    await engine.advance("into");
    const failed = await engine.advance("into");

    expect(failed.status).toBe("error");
    expect(failed.error?.message).toContain(
      'Property "constructor" is unavailable',
    );
  });
});
