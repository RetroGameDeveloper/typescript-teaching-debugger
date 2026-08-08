import { describe, expect, it } from "vitest";
import {
  annotateCode,
  parseTeachingComments,
  parseTeachingSymbols,
  teachingNotesFromComments,
} from "../src/teaching";

describe("Markdown teaching comments", () => {
  it("annotates source and parses notes, questions, and solutions back from it", () => {
    const annotated = annotateCode(
      "const value = 2;\nconsole.log(value);",
      {
        2: {
          title: "Display the value",
          explanation: "This confirms the **computed result**.",
          question: "What will `value` contain?",
          solution: "It contains `2`.",
        },
      },
    );
    const comments = parseTeachingComments(annotated.code);
    const targetLine = annotated.lineMap[2];

    expect(targetLine).toBeDefined();
    const note = teachingNotesFromComments(annotated.code)[targetLine ?? -1];

    expect(comments).toHaveLength(1);
    expect(annotated.code).toContain("### Question");
    expect(note).toEqual({
      title: "Display the value",
      explanation: "This confirms the **computed result**.",
      question: "What will `value` contain?",
      solution: "It contains `2`.",
    });
  });

  it("associates Markdown comments with function and variable declarations", () => {
    const annotated = annotateCode(
      "function double(value: number): number {\n  const result = value * 2;\n  return result;\n}",
      {
        1: {
          title: "Double a number",
          explanation: "Returns **twice** the supplied `value`.",
        },
        2: {
          title: "Store the product",
          explanation: "Keeps the current multiplication result.",
        },
      },
    );
    const symbols = parseTeachingSymbols(annotated.code);

    expect(symbols.map(({ kind, name }) => ({ kind, name }))).toEqual([
      { kind: "function", name: "double" },
      { kind: "parameter", name: "value" },
      { kind: "variable", name: "result" },
    ]);
    expect(symbols[0]?.note.explanation).toContain("**twice**");
    expect(symbols[0]?.note.arguments?.value).toBe(
      "The value supplied to this function.",
    );
    expect(symbols[1]?.note.explanation).toBe(
      "The value supplied to this function.",
    );
    expect(annotated.code).toContain("### Arguments");
    expect(annotated.code).toContain("* `value` - The value supplied to this function.");
    expect(annotated.code).toContain("\n  /**\n   * ## Store the product");
  });

  it("parses authored function argument documentation", () => {
    const code = `/**
 * ## Find a value
 * Searches the input from left to right.
 *
 * ### Arguments
 * * \`values\` - The collection being searched.
 * * \`target\` - The value to locate.
 */
function find(values: number[], target: number): number {
  return values.indexOf(target);
}`;
    const symbols = parseTeachingSymbols(code);

    expect(symbols.map(({ kind, name }) => ({ kind, name }))).toEqual([
      { kind: "function", name: "find" },
      { kind: "parameter", name: "values" },
      { kind: "parameter", name: "target" },
    ]);
    expect(symbols[2]?.note.explanation).toBe("The value to locate.");
  });

  it("keeps a configured question even when it has no solution yet", () => {
    const annotated = annotateCode("const value = 1;", {
      1: {
        title: "Choose a value",
        explanation: "Creates the example input.",
        question: "Why does the example start at `1`?",
      },
    });

    expect(annotated.code).toContain("### Question");
    expect(parseTeachingComments(annotated.code)[0]?.question).toBe(
      "Why does the example start at `1`?",
    );
  });

  it("generates a multiple-choice check from the explanation already shown", () => {
    const annotated = annotateCode(
      "if (value === target) return true;",
      {
        1: {
          title: "Compare with the target",
          explanation: "Checks whether the current value matches the target.",
        },
      },
      [1],
    );
    const comment = parseTeachingComments(annotated.code)[0];

    expect(comment?.question).toBe(
      "Based on the explanation above, which option best describes this step?",
    );
    expect(comment?.choices).toHaveLength(3);
    expect(comment?.answer).toBeGreaterThanOrEqual(0);
    expect(comment?.choices?.[comment?.answer ?? -1]).toBe(comment?.solution);
  });
});
