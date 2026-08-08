import { afterEach, describe, expect, it } from "vitest";
import {
  TsTeachingDebuggerElement,
} from "../src/ts-teaching-debugger";
import { algorithmExamples } from "../src/examples";
import { annotateCode, parseTeachingComments } from "../src/teaching";

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

  it("dims the selected lesson step and then the runtime pause", async () => {
    const annotated = annotateCode(
      "const first = 1;\nconst second = first + 1;",
      {
        1: { title: "Create the first value", explanation: "Stores `1`." },
        2: { title: "Create the second value", explanation: "Adds one more." },
      },
    );
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.code = annotated.code;
    document.body.append(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.shadowRoot?.querySelector(".cm-guided-dim")).not.toBeNull();
    expect(
      element.shadowRoot?.querySelector(".runtime-sidebar-controls")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(
      element.shadowRoot?.querySelector(".guided-sidebar-controls")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(element.shadowRoot?.querySelector('.sidebar [data-command="into"]')).not.toBeNull();

    await element.resume();

    expect(element.shadowRoot?.querySelector(".cm-debug-dim")).not.toBeNull();
    expect(element.shadowRoot?.querySelector(".cm-guided-dim")).toBeNull();
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

    expect(element.shadowRoot?.querySelector(".teaching-title")?.textContent).toBe(
      "Problem",
    );
    expect(
      element.shadowRoot?.querySelector(".teaching-copy strong")?.textContent,
    ).toBe("Linear search");
    expect(element.shadowRoot?.querySelector(".guided-overlay")).toBeNull();
    expect(element.shadowRoot?.querySelector(".ast-token")).toBeNull();
    const lessonLines = parseTeachingComments(linearSearch?.code ?? "")
      .map((comment) => comment.line)
      .filter((line) => !(linearSearch?.code.split("\n")[line - 1] ?? "").trimStart().startsWith("/**"));
    expect(lessonLines.every((line) => element.breakpoints.includes(line))).toBe(true);

    await element.reset();
    expect(element.shadowRoot?.querySelector(".teaching-title")?.textContent).toBe(
      "Problem",
    );
  });

  it("omits current values for functions but keeps them for variables", async () => {
    const annotated = annotateCode(
      "const input = 2;\nfunction double(value: number): number {\n  return value * 2;\n}",
      {
        1: { title: "Example input", explanation: "Stores the input value." },
        2: { title: "Double a number", explanation: "Returns twice the input." },
      },
    );
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.code = annotated.code;
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await element.stepInto();

    const internal = element as unknown as {
      createIdentifierHover(identifier: string, position: number): HTMLElement | undefined;
    };
    const functionPosition = annotated.code.indexOf("double");
    const variablePosition = annotated.code.indexOf("input");
    const functionHover = internal.createIdentifierHover("double", functionPosition);
    const variableHover = internal.createIdentifierHover("input", variablePosition);

    expect(functionHover?.querySelector(".hover-documentation")).not.toBeNull();
    expect(functionHover?.querySelector(".hover-label")).toBeNull();
    expect(variableHover?.querySelector(".hover-label")?.textContent).toBe(
      "Current value",
    );
  });

  it("navigates the lesson in the right panel in both directions", async () => {
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
    const title = element.shadowRoot?.querySelector(".teaching-title");
    const sidebarNext = element.shadowRoot?.querySelector<HTMLButtonElement>(
      ".sidebar-guided-next",
    );
    const sidebarPrevious = element.shadowRoot?.querySelector<HTMLButtonElement>(
      ".sidebar-guided-previous",
    );

    expect(element.shadowRoot?.querySelector(".cm-guided-dim")).not.toBeNull();
    expect(
      element.shadowRoot?.querySelector(".runtime-sidebar-controls")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(title?.textContent).toBe("Create the first value");
    expect(sidebarPrevious?.disabled).toBe(true);
    expect(element.shadowRoot?.querySelector(".teaching-question")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect(
      element.shadowRoot?.querySelectorAll(".teaching-question .choice-option"),
    ).toHaveLength(3);
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(".teaching-question .choice-option")
      ?.click();
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(".solution-toggle")
      ?.click();
    expect(
      element.shadowRoot?.querySelector(".teaching-solution")?.hasAttribute("hidden"),
    ).toBe(false);

    sidebarNext?.click();
    expect(title?.textContent).toBe("Derive the second value");
    expect(sidebarNext?.textContent).toBe("Finish");
    sidebarPrevious?.click();
    expect(title?.textContent).toBe("Create the first value");
  });
});
