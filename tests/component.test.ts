import { afterEach, describe, expect, it } from "vitest";
import {
  TsTeachingDebuggerElement,
} from "../src/ts-teaching-debugger";

afterEach(() => {
  document.body.replaceChildren();
});

describe("ts-teaching-debugger", () => {
  it("registers a custom element and exposes the debugger API", async () => {
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.code = "const answer: number = 42;\nconsole.log(answer);";
    element.breakpoints = [2];
    document.body.append(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(customElements.get("ts-teaching-debugger")).toBe(
      TsTeachingDebuggerElement,
    );
    expect(element.shadowRoot?.querySelector(".shell")).not.toBeNull();
    expect(element.breakpoints).toEqual([2]);
    expect(element.code).toContain("answer: number");

    const completed = await element.resume();
    expect(completed.status).toBe("paused");
    expect(completed.point?.range.startLine).toBe(2);

    const finished = await element.resume();
    expect(finished.status).toBe("complete");
    expect(element.shadowRoot?.querySelector(".console-content")?.textContent).toContain(
      "42",
    );
  });
});
