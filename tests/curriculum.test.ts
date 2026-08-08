import { describe, expect, it } from "vitest";
import { curriculumGroups } from "../src/curriculum";
import { algorithmExamples } from "../src/examples";

describe("algorithm curriculum", () => {
  it("starts with fundamentals and includes every example exactly once", () => {
    const curriculumIds = curriculumGroups.flatMap((group) => group.ids);
    const exampleIds = algorithmExamples.map((example) => example.id);

    expect(curriculumGroups[0]?.title).toBe("Fundamentals");
    expect(curriculumIds[0]).toBe("linear-search");
    expect(new Set(curriculumIds).size).toBe(curriculumIds.length);
    expect([...curriculumIds].sort()).toEqual([...exampleIds].sort());
  });
});
