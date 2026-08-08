import { describe, expect, it } from "vitest";
import {
  annotateCode,
  parseTeachingComments,
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
});
