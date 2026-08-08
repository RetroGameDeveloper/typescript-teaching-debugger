import { afterEach, describe, expect, it } from "vitest";
import {
  TsTeachingDebuggerElement,
} from "../src/ts-teaching-debugger";
import { algorithmExamples } from "../src/examples";
import { annotateCode } from "../src/teaching";

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
    const collapsedComment = element.shadowRoot?.querySelector<HTMLButtonElement>(
      '.cm-comment-toggle[data-expanded="false"]',
    );
    expect(collapsedComment).not.toBeNull();
    collapsedComment?.click();
    expect(
      element.shadowRoot?.querySelector('.cm-comment-toggle[data-expanded="true"]'),
    ).not.toBeNull();

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

    expect(element.shadowRoot?.querySelector('[data-view="questions"]')).toBeNull();

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

  it("starts an algorithm lesson with its beginner problem introduction", async () => {
    const linearSearch = algorithmExamples.find(
      (example) => example.id === "linear-search",
    );
    expect(linearSearch).toBeDefined();
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.code = linearSearch?.code ?? "";
    document.body.append(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.shadowRoot?.querySelector(".guided-title")?.textContent).toBe(
      "Problem",
    );
    expect(
      element.shadowRoot?.querySelector(".guided-documentation strong")?.textContent,
    ).toBe("Linear search");
  });

  it("navigates an optional guided walkthrough in both directions", async () => {
    const annotated = annotateCode(
      "const first = 1;\nconst second = first + 1;",
      {
        1: {
          title: "Create the first value",
          explanation: "This establishes the starting value.",
          question: "What value is stored?",
          solution: "The value is `1`.",
        },
        2: {
          title: "Derive the second value",
          explanation: "This builds on `first`.",
        },
      },
    );
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.code = annotated.code;
    document.body.append(element);

    await new Promise((resolve) => setTimeout(resolve, 0));
    const title = element.shadowRoot?.querySelector(".guided-title");
    const previous = element.shadowRoot?.querySelector<HTMLButtonElement>(
      ".guided-previous",
    );
    const next = element.shadowRoot?.querySelector<HTMLButtonElement>(
      ".guided-next",
    );

    expect(element.shadowRoot?.querySelector(".guided-overlay")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect(element.guidedMode).toBe(true);
    expect(title?.textContent).toBe("Create the first value");
    expect(previous?.disabled).toBe(true);
    expect(element.shadowRoot?.querySelector(".guided-question")?.hasAttribute("hidden")).toBe(
      false,
    );

    next?.click();
    expect(title?.textContent).toBe("Derive the second value");
    expect(next?.textContent).toBe("Finish");
    previous?.click();
    expect(title?.textContent).toBe("Create the first value");
  });
});
