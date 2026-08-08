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
      let lastFunction = -1;
      body.forEach((node, index) => {
        if (node.type === "FunctionDeclaration") lastFunction = index;
      });
      const reportIndexes = body.flatMap((node, index) => {
        if (node.type !== "ExpressionStatement" || node.expression.type !== "CallExpression") {
          return [];
        }
        const callee = node.expression.callee;
        return callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.object.type === "Identifier" &&
          callee.object.name === "console" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "log"
          ? [index]
          : [];
      });

      expect(example.code.startsWith("/**\n * # Problem")).toBe(true);
      expect(example.code).toContain(" * ## How it works");
      expect(firstFunction).toBeGreaterThan(0);
      expect(reportIndexes.length).toBeGreaterThan(0);
      expect(reportIndexes.every((index) => index > lastFunction)).toBe(true);
      expect(
        body.slice(0, firstFunction).some((node) => !node.type.startsWith("TS")),
      ).toBe(true);
    });
  }
});
