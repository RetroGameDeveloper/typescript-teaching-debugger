import { parse } from "@babel/parser";

export interface ReorderedCode {
  code: string;
  lineMap: Record<number, number>;
}

interface SourceSection {
  endLine: number;
  kind: "function" | "report" | "runtime" | "type";
  startLine: number;
}

function isConsoleReport(node: ReturnType<typeof parse>["program"]["body"][number]): boolean {
  if (node.type !== "ExpressionStatement" || node.expression.type !== "CallExpression") {
    return false;
  }

  const callee = node.expression.callee;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "console" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "log"
  );
}

export function reorderForLearning(code: string): ReorderedCode {
  const program = parse(code, {
    plugins: ["typescript"],
    sourceType: "module",
  }).program;
  const sourceLines = code.split("\n");
  const sections: SourceSection[] = program.body.flatMap((node) => {
    if (!node.loc) return [];

    return [
      {
        endLine: node.loc.end.line,
        kind:
          node.type === "FunctionDeclaration"
            ? "function"
            : isConsoleReport(node)
              ? "report"
            : node.type.startsWith("TS")
              ? "type"
              : "runtime",
        startLine: node.loc.start.line,
      },
    ];
  });
  const ordered = ["type", "runtime", "function", "report"].flatMap((kind) =>
    sections.filter((section) => section.kind === kind),
  );
  const output: string[] = [];
  const lineMap: Record<number, number> = {};

  for (const section of ordered) {
    if (output.length > 0) output.push("");
    const newStart = output.length + 1;
    const sectionLines = sourceLines.slice(section.startLine - 1, section.endLine);

    for (let offset = 0; offset < sectionLines.length; offset += 1) {
      lineMap[section.startLine + offset] = newStart + offset;
    }

    output.push(...sectionLines);
  }

  return { code: output.join("\n"), lineMap };
}

function jsdocTextLines(text: string): string[] {
  return text.split("\n").map((line) => (line.trim() === "" ? " *" : ` * ${line}`));
}

export function problemComment(
  title: string,
  analogy: string,
  explanation: string,
): string {
  return [
    "/**",
    " * # Problem",
    " *",
    ` * **${title}**`,
    " *",
    ...jsdocTextLines(analogy),
    " *",
    " * ## How it works",
    " *",
    ...jsdocTextLines(explanation),
    " */",
  ].join("\n");
}
