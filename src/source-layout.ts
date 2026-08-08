import { parse } from "@babel/parser";

export interface ReorderedCode {
  code: string;
  lineMap: Record<number, number>;
}

interface SourceSection {
  endLine: number;
  kind: "function" | "runtime" | "type";
  startLine: number;
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
            : node.type.startsWith("TS")
              ? "type"
              : "runtime",
        startLine: node.loc.start.line,
      },
    ];
  });
  const ordered = ["type", "runtime", "function"].flatMap((kind) =>
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

export function problemComment(title: string, description: string): string {
  return [
    "/**",
    " * # Problem",
    " *",
    ` * **${title}:** ${description}`,
    " */",
  ].join("\n");
}
