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
    element.code = `const answer: number = 42;
/**
 * ## Display the computed answer
 * This output confirms the example produced **42**.
 *
 * ### Question
 * What value will be printed?
 *
 * ### Solution
 * The program prints \`42\`.
 */
console.log(answer);`;
    element.breakpoints = [12];
    document.body.append(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(customElements.get("ts-teaching-debugger")).toBe(
      TsTeachingDebuggerElement,
    );
    expect(element.shadowRoot?.querySelector(".shell")).not.toBeNull();
    expect(element.breakpoints).toEqual([12]);
    expect(element.code).toContain("answer: number");

    const completed = await element.resume();
    expect(completed.status).toBe("paused");
    expect(completed.point?.range.startLine).toBe(12);
    expect(element.shadowRoot?.querySelector(".teaching-title")?.textContent).toBe(
      "Display the computed answer",
    );
    expect(element.shadowRoot?.querySelector(".teaching-question")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect(element.shadowRoot?.querySelector(".teaching-copy strong")?.textContent).toBe(
      "42",
    );

    const reveal = element.shadowRoot?.querySelector<HTMLButtonElement>(
      ".solution-toggle",
    );
    reveal?.click();
    expect(element.shadowRoot?.querySelector(".teaching-solution")?.hasAttribute("hidden")).toBe(
      false,
    );

    const questions = element.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-view="questions"]',
    );
    questions?.click();
    expect(element.showQuestions).toBe(false);
    expect(element.shadowRoot?.querySelector(".teaching-question")?.hasAttribute("hidden")).toBe(
      true,
    );

    const comments = element.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-view="comments"]',
    );
    comments?.click();
    expect(element.showComments).toBe(true);

    const finished = await element.resume();
    expect(finished.status).toBe("complete");
    expect(element.shadowRoot?.querySelector(".console-content")?.textContent).toContain(
      "42",
    );
  });

  it("automatically resets after execution completes", async () => {
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.code = "console.log('done');";
    element.autoResetDelay = 0;
    document.body.append(element);

    await new Promise((resolve) => setTimeout(resolve, 0));
    const resetPause = new Promise<void>((resolve) => {
      element.addEventListener("debugger-paused", () => resolve(), { once: true });
    });
    const complete = await element.resume();

    expect(complete.status).toBe("complete");
    await resetPause;
    expect(
      element.shadowRoot?.querySelector(".statusbar-state")?.getAttribute("data-status"),
    ).toBe("paused");
  });
});
