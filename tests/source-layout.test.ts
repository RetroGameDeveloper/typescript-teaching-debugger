import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";
import { algorithmExamples } from "../src/examples";

describe("example source layout", () => {
  for (const example of algorithmExamples) {
    it(`presents ${example.title} from problem to invocation to implementation`, () => {
      const body = parse(example.code, {
        plugins: ["typescript"],
        sourceType: "module",
      }).program.body;
      const firstFunction = body.findIndex(
        (node) => node.type === "FunctionDeclaration",
      );

      expect(example.code.startsWith("/**\n * # Problem")).toBe(true);
      expect(firstFunction).toBeGreaterThan(0);
      expect(body.slice(firstFunction).every((node) => node.type === "FunctionDeclaration")).toBe(
        true,
      );
      expect(
        body.slice(0, firstFunction).some((node) => !node.type.startsWith("TS")),
      ).toBe(true);
    });
  }
});
