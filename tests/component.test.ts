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
    expect(element.shadowRoot?.querySelector(".teaching-title")?.textContent).toBe(
      "Display the computed answer",
    );

    const reveal = element.shadowRoot?.querySelector<HTMLButtonElement>(
      ".solution-toggle",
    );
    expect(reveal?.disabled).toBe(true);
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(".teaching-question .choice-option")
      ?.click();
    expect(reveal?.disabled).toBe(false);
    reveal?.click();
    expect(element.shadowRoot?.querySelector(".teaching-solution")?.hasAttribute("hidden")).toBe(
      false,
    );

    expect(element.shadowRoot?.querySelector('[data-view="questions"]')).toBeNull();

    expect(element.shadowRoot?.querySelector('[data-view="comments"]')).toBeNull();

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

  it("dims unfocused code and shows runtime controls while normally paused", async () => {
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.guidedMode = false;
    element.code = "const first = 1;\nconst second = first + 1;";
    document.body.append(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.shadowRoot?.querySelector(".cm-debug-dim")).not.toBeNull();
    expect(element.shadowRoot?.querySelector(".cm-guided-dim")).toBeNull();
    expect(
      element.shadowRoot?.querySelector(".runtime-sidebar-controls")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(
      element.shadowRoot?.querySelector(".guided-sidebar-controls")?.hasAttribute("hidden"),
    ).toBe(true);
    expect(element.shadowRoot?.querySelector('.sidebar [data-command="into"]')).not.toBeNull();
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
    const sidebarNext = element.shadowRoot?.querySelector<HTMLButtonElement>(
      ".sidebar-guided-next",
    );
    const sidebarPrevious = element.shadowRoot?.querySelector<HTMLButtonElement>(
      ".sidebar-guided-previous",
    );

    expect(element.shadowRoot?.querySelector(".guided-overlay")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect(element.guidedMode).toBe(true);
    expect(element.shadowRoot?.querySelector(".cm-guided-dim")).not.toBeNull();
    expect(
      element.shadowRoot?.querySelector(".runtime-sidebar-controls")?.hasAttribute("hidden"),
    ).toBe(true);
    expect(
      element.shadowRoot?.querySelector(".guided-sidebar-controls")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(title?.textContent).toBe("Create the first value");
    expect(element.shadowRoot?.querySelector(".teaching-title")?.textContent).toBe(
      "Create the first value",
    );
    expect(previous?.disabled).toBe(true);
    expect(element.shadowRoot?.querySelector(".guided-question")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect(
      element.shadowRoot?.querySelectorAll(".guided-question .choice-option"),
    ).toHaveLength(3);
    const guidedQuestion = element.shadowRoot?.querySelector(".guided-question");
    const guidedDocumentation = element.shadowRoot?.querySelector(
      ".guided-documentation",
    );
    const questionBeforeDocumentation =
      guidedQuestion && guidedDocumentation
        ? guidedQuestion.compareDocumentPosition(guidedDocumentation)
        : 0;
    expect(
      Boolean(questionBeforeDocumentation & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(guidedDocumentation?.hasAttribute("hidden")).toBe(true);
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(".guided-question .choice-option")
      ?.click();
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(".guided-solution-toggle")
      ?.click();
    expect(
      element.shadowRoot?.querySelector(".guided-solution")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(
      element.shadowRoot?.querySelector(".teaching-solution")?.hasAttribute("hidden"),
    ).toBe(false);

    sidebarNext?.click();
    expect(title?.textContent).toBe("Derive the second value");
    expect(next?.textContent).toBe("Finish");
    expect(element.shadowRoot?.querySelector(".teaching-title")?.textContent).toBe(
      "Derive the second value",
    );
    sidebarPrevious?.click();
    expect(title?.textContent).toBe("Create the first value");
  });
});
