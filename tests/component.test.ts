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
    const expandedComment = element.shadowRoot?.querySelector<HTMLButtonElement>(
      '.cm-comment-toggle[data-expanded="true"]',
    );
    expect(expandedComment).not.toBeNull();
    expandedComment?.click();
    expect(
      element.shadowRoot?.querySelector('.cm-comment-toggle[data-expanded="false"]'),
    ).not.toBeNull();

    const completed = await element.resume();
    expect(completed.status).toBe("paused");
    expect(completed.point?.range.startLine).toBe(12);
    expect(element.shadowRoot?.querySelector(".teaching-title")?.textContent).toBe(
      "Quick check",
    );
    expect(element.shadowRoot?.querySelector(".teaching-question")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect(element.shadowRoot?.querySelector(".teaching-title")?.textContent).toBe(
      "Quick check",
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
    const complete = await element.resume();

    expect(complete.status).toBe("complete");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(
      element.shadowRoot?.querySelector(".statusbar-state")?.getAttribute("data-status"),
    ).toBe("ready");
  });

  it("can remain complete with all source-code dimming removed", async () => {
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.code = "const value = 1;\nconsole.log(value);";
    element.teachingNotes = {
      1: { title: "Create a value", explanation: "Stores `1`." },
    };
    element.autoResetDelay = -1;
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await element.resume();
    const completed = await element.resume();
    expect(completed.status).toBe("complete");
    expect(
      element.shadowRoot?.querySelector(".statusbar-state")?.getAttribute("data-status"),
    ).toBe("complete");
    expect(element.shadowRoot?.querySelector(".cm-debug-dim")).toBeNull();
    expect(element.shadowRoot?.querySelector(".cm-guided-dim")).toBeNull();
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
    expect(element.shadowRoot?.querySelector(".guided-sidebar-controls")).toBeNull();
    expect(element.shadowRoot?.querySelector(".pause-summary")).toBeNull();
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
    element.teachingNotes = linearSearch?.teachingNotes;
    document.body.append(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.shadowRoot?.querySelector(".teaching-card")?.hasAttribute("hidden")).toBe(
      true,
    );
    expect(element.shadowRoot?.querySelector(".guided-overlay")).toBeNull();
    expect(element.shadowRoot?.querySelector(".ast-token")).toBeNull();
    expect(element.breakpoints).toEqual([]);

    await element.reset();
    expect(element.shadowRoot?.querySelector(".teaching-card")?.hasAttribute("hidden")).toBe(
      true,
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

  it("pauses once on each lesson note without exposing them as breakpoints", async () => {
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
    const lessonLines = parseTeachingComments(annotated.code).map(({ line }) => line);

    expect(element.shadowRoot?.querySelector(".cm-guided-dim")).not.toBeNull();
    expect(element.oneTimeBreakpoints).toEqual([]);
    expect(element.breakpoints).toEqual([]);
    expect(element.shadowRoot?.querySelector(".sidebar-guided-next")).toBeNull();

    const first = await element.resume();
    expect(first.point?.range.startLine).toBe(lessonLines[0]);
    expect(element.breakpoints).toEqual([]);
    expect(element.shadowRoot?.querySelector(".teaching-title")?.textContent).toBe(
      "Quick check",
    );

    const second = await element.resume();
    expect(second.point?.range.startLine).toBe(lessonLines[1]);
    expect(element.shadowRoot?.querySelector(".teaching-card")?.hasAttribute("hidden")).toBe(
      true,
    );
  });

  it("can independently ignore lesson notes and deactivate breakpoints", async () => {
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.code = "const first = 1;\nconst second = first + 1;";
    element.teachingNotes = {
      1: { title: "First note", explanation: "Explains the first line." },
    };
    element.breakpoints = [2];
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const notesToggle = element.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-debug-toggle="notes"]',
    );
    const breakpointsToggle = element.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-debug-toggle="breakpoints"]',
    );
    notesToggle?.click();

    expect(element.pauseOnTeachingNotes).toBe(false);
    expect(notesToggle?.getAttribute("aria-pressed")).toBe("true");
    const breakpointPause = await element.resume();
    expect(breakpointPause.point?.range.startLine).toBe(2);

    await element.reset();
    breakpointsToggle?.click();
    expect(element.breakpointsEnabled).toBe(false);
    expect(breakpointsToggle?.getAttribute("aria-pressed")).toBe("true");
    const completed = await element.resume();
    expect(completed.status).toBe("complete");
    expect(element.breakpoints).toEqual([2]);
  });

  it("pauses only once when a noted line executes repeatedly", async () => {
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.code = `let count = 0;
while (count < 2) {
  count += 1;
}
console.log(count);`;
    element.teachingNotes = {
      3: { title: "Increment the count", explanation: "Runs twice." },
    };
    element.autoResetDelay = -1;
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const first = await element.resume();
    expect(first.status).toBe("paused");
    expect(first.point?.range.startLine).toBe(3);

    const completed = await element.resume();
    expect(completed.status).toBe("complete");

    await element.reset();
    const afterReset = await element.resume();
    expect(afterReset.status).toBe("paused");
    expect(afterReset.point?.range.startLine).toBe(3);
  });

  it("cycles gutter breakpoints from regular to one-time to removed", async () => {
    const element = document.createElement("ts-teaching-debugger") as TsTeachingDebuggerElement;
    element.code = "const value = 1;";
    element.breakpoints = [1];
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const gutterLine = [...(element.shadowRoot?.querySelectorAll<HTMLElement>(
      ".cm-breakpoint-gutter .cm-gutterElement",
    ) ?? [])].find((line) =>
      line.matches(".cm-breakpoint-marker") || line.querySelector(".cm-breakpoint-marker"),
    );
    expect(gutterLine).toBeDefined();

    gutterLine?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(element.breakpoints).toEqual([1]);
    expect(element.oneTimeBreakpoints).toEqual([1]);
    expect(element.shadowRoot?.querySelector(".cm-breakpoint-marker-once")).not.toBeNull();

    gutterLine?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(element.breakpoints).toEqual([]);
    expect(
      [...(element.shadowRoot?.querySelectorAll<HTMLElement>(".cm-breakpoint-marker") ?? [])]
        .filter((marker) => marker.style.visibility !== "hidden"),
    ).toHaveLength(0);
  });

  it("keeps the teaching card in the sidebar by default", async () => {
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.code = "const value = 1;";
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.teachingPlacement).toBe("sidebar");
    expect(
      element.shadowRoot
        ?.querySelector(".teaching-card")
        ?.closest("[data-teaching-host]")
        ?.getAttribute("data-teaching-host"),
    ).toBe("sidebar");
    expect(
      element.shadowRoot?.querySelector(".shell")?.getAttribute("data-teaching-placement"),
    ).toBe("sidebar");

    element.teachingPlacement = "bottom";
    expect(element.teachingPlacement).toBe("bottom");
    expect(
      element.shadowRoot
        ?.querySelector(".teaching-card")
        ?.closest("[data-teaching-host]")
        ?.getAttribute("data-teaching-host"),
    ).toBe("bottom");
  });

  it("honors the teaching-placement attribute", async () => {
    const element = document.createElement(
      "ts-teaching-debugger",
    ) as TsTeachingDebuggerElement;
    element.setAttribute("teaching-placement", "bottom");
    element.code = "const value = 1;";
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.teachingPlacement).toBe("bottom");
    expect(
      element.shadowRoot?.querySelector(
        '[data-teaching-host="bottom"] .teaching-card',
      ),
    ).not.toBeNull();
    expect(
      element.shadowRoot?.querySelector(
        '[data-teaching-host="sidebar"] .teaching-card',
      ),
    ).toBeNull();
  });

  it("expands the active teaching comment and folds the previous one", async () => {
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

    const initialToggles = [
      ...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(".cm-comment-toggle") ?? []),
    ];
    expect(initialToggles.map((toggle) => toggle.dataset.expanded)).toEqual([
      "true",
      "false",
    ]);

    await element.resume();
    await element.resume();

    const nextToggles = [
      ...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(".cm-comment-toggle") ?? []),
    ];
    expect(nextToggles.map((toggle) => toggle.dataset.expanded)).toEqual([
      "false",
      "true",
    ]);
  });

  it("steps backwards to an earlier executable state", async () => {
    const element = document.createElement("ts-teaching-debugger") as TsTeachingDebuggerElement;
    element.code = "const first = 1;\nconst second = first + 1;";
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const first = await element.stepInto();
    const second = await element.stepInto();
    expect(first.point?.range.startLine).toBe(1);
    expect(second.point?.range.startLine).toBe(2);

    const previous = await element.stepBack();
    expect(previous.point?.range.startLine).toBe(1);
    expect(element.shadowRoot?.querySelector(".cursor-location")?.textContent).toContain("Ln 1");
  });
});
