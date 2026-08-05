import { parse } from "@babel/parser";
import type * as t from "@babel/types";
import { Environment } from "./environment";
import type {
  CallFrameSnapshot,
  ExecutionPoint,
  InterpreterOptions,
  SourceRange,
} from "./types";

interface RuntimeFrame {
  callSite?: t.SourceLocation | null;
  environment: Environment;
  id: number;
  name: string;
}

interface UserFunction {
  closure: Environment;
  name: string;
  node:
    | t.ArrowFunctionExpression
    | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ObjectMethod;
  type: "user-function";
}

type Completion =
  | { type: "break" | "continue" | "normal" }
  | { type: "return"; value: unknown };

interface Reference {
  get: () => unknown;
  set: (value: unknown) => unknown;
}

type BindingPattern = t.PatternLike | t.TSParameterProperty | t.VoidPattern;

const NORMAL: Completion = { type: "normal" };

function isUserFunction(value: unknown): value is UserFunction {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as UserFunction).type === "user-function"
  );
}

function nodeRange(node: t.Node): SourceRange {
  const location = node.loc;

  return {
    start: node.start ?? 0,
    end: node.end ?? node.start ?? 0,
    startLine: location?.start.line ?? 1,
    startColumn: location?.start.column ?? 0,
    endLine: location?.end.line ?? location?.start.line ?? 1,
    endColumn: location?.end.column ?? location?.start.column ?? 0,
  };
}

function nodeLabel(node: t.Node): string {
  const labels: Partial<Record<t.Node["type"], string>> = {
    AssignmentExpression: "Assign value",
    BreakStatement: "Break",
    CallExpression: "Call function",
    ContinueStatement: "Continue",
    DoWhileStatement: "Check do/while condition",
    ExpressionStatement: "Evaluate expression",
    ForInStatement: "Advance for/in loop",
    ForOfStatement: "Advance for/of loop",
    ForStatement: "Check for-loop condition",
    FunctionDeclaration: "Declare function",
    IfStatement: "Check condition",
    ReturnStatement: "Return from function",
    SwitchStatement: "Select switch case",
    ThrowStatement: "Throw value",
    TryStatement: "Enter try block",
    VariableDeclaration: "Declare variable",
    WhileStatement: "Check while condition",
  };

  return labels[node.type] ?? node.type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function propertyKey(
  property: t.Expression | t.PrivateName,
  computed: boolean,
  evaluated?: unknown,
): PropertyKey {
  let key: PropertyKey;

  if (computed) {
    key = evaluated as PropertyKey;
  } else if (property.type === "Identifier") {
    key = property.name;
  } else if (
    property.type === "StringLiteral" ||
    property.type === "NumericLiteral"
  ) {
    key = property.value;
  } else {
    throw new SyntaxError(`Unsupported property key: ${property.type}`);
  }

  if (
    typeof key === "string" &&
    [
      "__defineGetter__",
      "__defineSetter__",
      "__lookupGetter__",
      "__lookupSetter__",
      "__proto__",
      "caller",
      "callee",
      "constructor",
      "prototype",
    ].includes(key)
  ) {
    throw new TypeError(`Property "${key}" is unavailable in the teaching sandbox`);
  }

  return key;
}

export class AstInterpreter {
  private readonly frames: RuntimeFrame[] = [];
  private readonly globalEnvironment: Environment;
  private frameSequence = 0;

  readonly program: t.Program;

  constructor(
    source: string,
    private readonly options: InterpreterOptions = {},
  ) {
    const file = parse(source, {
      allowAwaitOutsideFunction: false,
      errorRecovery: false,
      plugins: ["typescript"],
      sourceType: "module",
    });

    this.program = file.program;
    this.globalEnvironment = this.createGlobalEnvironment();
  }

  *execute(): Generator<ExecutionPoint, unknown, void> {
    const moduleEnvironment = new Environment(
      "Module",
      this.globalEnvironment,
    );
    this.pushFrame("<module>", moduleEnvironment);

    try {
      const completion = yield* this.executeStatements(
        this.program.body,
        moduleEnvironment,
      );
      return completion.type === "return" ? completion.value : undefined;
    } finally {
      this.frames.pop();
    }
  }

  private createGlobalEnvironment(): Environment {
    const environment = new Environment("Globals", undefined, true);
    const consoleApi = {
      error: (...values: unknown[]) =>
        this.options.onConsole?.({ level: "error", values }),
      info: (...values: unknown[]) =>
        this.options.onConsole?.({ level: "info", values }),
      log: (...values: unknown[]) =>
        this.options.onConsole?.({ level: "log", values }),
      warn: (...values: unknown[]) =>
        this.options.onConsole?.({ level: "warn", values }),
    };
    const safeArray = Object.assign(
      (...values: unknown[]) => values,
      {
        from: (value: Iterable<unknown> | ArrayLike<unknown>) => Array.from(value),
        isArray: Array.isArray,
        of: (...values: unknown[]) => values,
      },
    );
    const safeBoolean = (value: unknown) => Boolean(value);
    const safeNumber = Object.assign(
      (value: unknown) => Number(value),
      {
        EPSILON: Number.EPSILON,
        MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER,
        MIN_SAFE_INTEGER: Number.MIN_SAFE_INTEGER,
        isFinite: Number.isFinite,
        isInteger: Number.isInteger,
        isNaN: Number.isNaN,
        isSafeInteger: Number.isSafeInteger,
        parseFloat: Number.parseFloat,
        parseInt: Number.parseInt,
      },
    );
    const safeObject = Object.assign(
      (value?: unknown) => (value == null ? {} : Object(value)),
      {
        assign: Object.assign,
        entries: Object.entries,
        freeze: Object.freeze,
        fromEntries: Object.fromEntries,
        hasOwn: Object.hasOwn,
        is: Object.is,
        keys: Object.keys,
        seal: Object.seal,
        values: Object.values,
      },
    );
    const safeString = Object.assign(
      (value: unknown) => String(value),
      {
        fromCharCode: String.fromCharCode,
        fromCodePoint: String.fromCodePoint,
        raw: String.raw,
      },
    );
    const safeMath = Object.fromEntries(
      Object.getOwnPropertyNames(Math).map((name) => {
        const value = (Math as unknown as Record<string, unknown>)[name];
        return [name, typeof value === "function" ? value.bind(Math) : value];
      }),
    );
    const globals: Record<string, unknown> = {
      Array: Object.freeze(safeArray),
      Boolean: Object.freeze(safeBoolean),
      Infinity,
      JSON: Object.freeze({ parse: JSON.parse, stringify: JSON.stringify }),
      Math: Object.freeze(safeMath),
      NaN,
      Number: Object.freeze(safeNumber),
      Object: Object.freeze(safeObject),
      String: Object.freeze(safeString),
      console: Object.freeze(consoleApi),
      isFinite,
      isNaN,
      parseFloat,
      parseInt,
      undefined,
    };

    for (const [name, value] of Object.entries(globals)) {
      environment.define(name, value, "const");
    }

    return environment;
  }

  private pushFrame(
    name: string,
    environment: Environment,
    callSite?: t.SourceLocation | null,
  ): RuntimeFrame {
    const frame = {
      id: ++this.frameSequence,
      name,
      environment,
      callSite,
    };
    this.frames.push(frame);
    return frame;
  }

  private point(node: t.Node, environment: Environment): ExecutionPoint {
    const frame = this.frames.at(-1);

    if (!frame) {
      throw new Error("Execution frame is unavailable");
    }

    return {
      callStack: this.callStack(node),
      frameDepth: this.frames.length - 1,
      frameId: frame.id,
      label: nodeLabel(node),
      nodeType: node.type,
      range: nodeRange(node),
      scopes: environment.snapshots(),
    };
  }

  private callStack(node: t.Node): CallFrameSnapshot[] {
    return [...this.frames].reverse().map((frame, index) => {
      const location = index === 0 ? node.loc : frame.callSite;

      return {
        id: frame.id,
        name: frame.name,
        line: location?.start.line ?? 1,
        column: location?.start.column ?? 0,
      };
    });
  }

  private *executeStatements(
    statements: readonly (t.Statement | t.ModuleDeclaration)[],
    environment: Environment,
  ): Generator<ExecutionPoint, Completion, void> {
    this.hoistFunctions(statements, environment);

    for (const statement of statements) {
      if (this.isTypeOnlyStatement(statement)) {
        continue;
      }

      const completion = yield* this.executeStatement(statement, environment);

      if (completion.type !== "normal") {
        return completion;
      }
    }

    return NORMAL;
  }

  private hoistFunctions(
    statements: readonly (t.Statement | t.ModuleDeclaration)[],
    environment: Environment,
  ): void {
    for (const statement of statements) {
      if (statement.type === "FunctionDeclaration" && statement.id) {
        environment.define(
          statement.id.name,
          this.createUserFunction(statement, environment),
          "function",
        );
      }
    }
  }

  private isTypeOnlyStatement(
    statement: t.Statement | t.ModuleDeclaration,
  ): boolean {
    return (
      statement.type.startsWith("TS") ||
      statement.type === "ImportDeclaration" ||
      statement.type === "ExportAllDeclaration" ||
      statement.type === "ExportNamedDeclaration" ||
      statement.type === "ExportDefaultDeclaration"
    );
  }

  private *executeStatement(
    statement: t.Statement | t.ModuleDeclaration,
    environment: Environment,
  ): Generator<ExecutionPoint, Completion, void> {
    yield this.point(statement, environment);

    switch (statement.type) {
      case "BlockStatement": {
        const block = new Environment("Block", environment);
        return yield* this.executeStatements(statement.body, block);
      }
      case "VariableDeclaration":
        yield* this.executeVariableDeclaration(statement, environment);
        return NORMAL;
      case "ExpressionStatement":
        yield* this.evaluate(statement.expression, environment);
        return NORMAL;
      case "FunctionDeclaration":
      case "EmptyStatement":
      case "DebuggerStatement":
        return NORMAL;
      case "ReturnStatement":
        return {
          type: "return",
          value: statement.argument
            ? yield* this.evaluate(statement.argument, environment)
            : undefined,
        };
      case "IfStatement": {
        const test = yield* this.evaluate(statement.test, environment);
        const branch = test ? statement.consequent : statement.alternate;
        return branch
          ? yield* this.executeStatement(branch, environment)
          : NORMAL;
      }
      case "WhileStatement":
        return yield* this.executeWhile(statement, environment);
      case "DoWhileStatement":
        return yield* this.executeDoWhile(statement, environment);
      case "ForStatement":
        return yield* this.executeFor(statement, environment);
      case "ForOfStatement":
      case "ForInStatement":
        return yield* this.executeForEach(statement, environment);
      case "BreakStatement":
        return { type: "break" };
      case "ContinueStatement":
        return { type: "continue" };
      case "ThrowStatement":
        throw yield* this.evaluate(statement.argument, environment);
      case "TryStatement":
        return yield* this.executeTry(statement, environment);
      case "SwitchStatement":
        return yield* this.executeSwitch(statement, environment);
      case "LabeledStatement":
        return yield* this.executeStatement(statement.body, environment);
      default:
        throw new SyntaxError(
          `Unsupported executable statement: ${statement.type}`,
        );
    }
  }

  private *executeVariableDeclaration(
    declaration: t.VariableDeclaration,
    environment: Environment,
  ): Generator<ExecutionPoint, void, void> {
    for (const declarator of declaration.declarations) {
      const value = declarator.init
        ? yield* this.evaluate(declarator.init, environment)
        : undefined;
      const kind =
        declaration.kind === "using" || declaration.kind === "await using"
          ? "const"
          : declaration.kind;
      this.bindPattern(declarator.id, value, environment, kind);
    }
  }

  private bindPattern(
    pattern: BindingPattern,
    value: unknown,
    environment: Environment,
    kind: "const" | "let" | "param" | "var",
  ): void {
    if (pattern.type === "TSParameterProperty") {
      this.bindPattern(pattern.parameter, value, environment, kind);
      return;
    }

    if (pattern.type === "Identifier") {
      environment.define(pattern.name, value, kind);
      return;
    }

    if (pattern.type === "AssignmentPattern") {
      this.bindPattern(
        pattern.left,
        value === undefined ? this.evaluateImmediate(pattern.right, environment) : value,
        environment,
        kind,
      );
      return;
    }

    if (pattern.type === "RestElement") {
      this.bindPattern(pattern.argument, value, environment, kind);
      return;
    }

    if (pattern.type === "ArrayPattern") {
      const values = Array.from((value ?? []) as Iterable<unknown>);
      pattern.elements.forEach((element, index) => {
        if (element) {
          this.bindPattern(element, values[index], environment, kind);
        }
      });
      return;
    }

    if (pattern.type === "ObjectPattern") {
      const object = Object(value) as Record<PropertyKey, unknown>;

      for (const property of pattern.properties) {
        if (property.type === "RestElement") {
          throw new SyntaxError("Object rest patterns are not yet supported");
        }

        const key = propertyKey(property.key, property.computed);
        this.bindPattern(
          property.value as BindingPattern,
          object[key],
          environment,
          kind,
        );
      }
      return;
    }

    throw new SyntaxError(`Unsupported binding pattern: ${pattern.type}`);
  }

  private evaluateImmediate(expression: t.Expression, environment: Environment): unknown {
    const iterator = this.evaluate(expression, environment);
    const result = iterator.next();

    if (!result.done) {
      throw new Error("Default parameter expressions cannot pause execution");
    }

    return result.value;
  }

  private *executeWhile(
    statement: t.WhileStatement,
    environment: Environment,
  ): Generator<ExecutionPoint, Completion, void> {
    let firstCheck = true;

    while (true) {
      if (!firstCheck) {
        yield this.point(statement, environment);
      }
      firstCheck = false;

      if (!(yield* this.evaluate(statement.test, environment))) {
        return NORMAL;
      }

      const completion = yield* this.executeStatement(statement.body, environment);

      if (completion.type === "break") return NORMAL;
      if (completion.type === "return") return completion;
    }
  }

  private *executeDoWhile(
    statement: t.DoWhileStatement,
    environment: Environment,
  ): Generator<ExecutionPoint, Completion, void> {
    let firstCheck = true;

    do {
      if (!firstCheck) {
        yield this.point(statement, environment);
      }
      firstCheck = false;
      const completion = yield* this.executeStatement(statement.body, environment);

      if (completion.type === "break") return NORMAL;
      if (completion.type === "return") return completion;
    } while (yield* this.evaluate(statement.test, environment));

    return NORMAL;
  }

  private *executeFor(
    statement: t.ForStatement,
    parent: Environment,
  ): Generator<ExecutionPoint, Completion, void> {
    const environment = new Environment("For block", parent);

    if (statement.init) {
      if (statement.init.type === "VariableDeclaration") {
        yield* this.executeVariableDeclaration(statement.init, environment);
      } else {
        yield* this.evaluate(statement.init, environment);
      }
    }

    let firstCheck = true;

    while (!statement.test || (yield* this.evaluate(statement.test, environment))) {
      if (!firstCheck) {
        yield this.point(statement, environment);
      }
      firstCheck = false;
      const completion = yield* this.executeStatement(statement.body, environment);

      if (completion.type === "break") return NORMAL;
      if (completion.type === "return") return completion;
      if (statement.update) yield* this.evaluate(statement.update, environment);
    }

    return NORMAL;
  }

  private *executeForEach(
    statement: t.ForInStatement | t.ForOfStatement,
    parent: Environment,
  ): Generator<ExecutionPoint, Completion, void> {
    const source = yield* this.evaluate(statement.right, parent);
    const values =
      statement.type === "ForInStatement"
        ? Object.keys(Object(source))
        : Array.from(source as Iterable<unknown>);

    for (let index = 0; index < values.length; index += 1) {
      if (index > 0) {
        yield this.point(statement, parent);
      }

      const environment = new Environment("Loop", parent);
      const value = values[index];

      if (statement.left.type === "VariableDeclaration") {
        const declaration = statement.left.declarations[0];

        if (!declaration) {
          throw new SyntaxError("For loop requires a binding");
        }

        const kind =
          statement.left.kind === "using" ||
          statement.left.kind === "await using"
            ? "const"
            : statement.left.kind;
        this.bindPattern(
          declaration.id,
          value,
          environment,
          kind,
        );
      } else {
        const reference = yield* this.resolveReference(statement.left, environment);
        reference.set(value);
      }

      const completion = yield* this.executeStatement(statement.body, environment);

      if (completion.type === "break") return NORMAL;
      if (completion.type === "return") return completion;
    }

    return NORMAL;
  }

  private *executeTry(
    statement: t.TryStatement,
    environment: Environment,
  ): Generator<ExecutionPoint, Completion, void> {
    let completion: Completion = NORMAL;

    try {
      completion = yield* this.executeStatement(statement.block, environment);
    } catch (error) {
      if (!statement.handler) throw error;
      const catchEnvironment = new Environment("Catch", environment);

      if (statement.handler.param) {
        this.bindPattern(statement.handler.param, error, catchEnvironment, "let");
      }

      completion = yield* this.executeStatement(
        statement.handler.body,
        catchEnvironment,
      );
    } finally {
      if (statement.finalizer) {
        const finalCompletion = yield* this.executeStatement(
          statement.finalizer,
          environment,
        );

        if (finalCompletion.type !== "normal") {
          completion = finalCompletion;
        }
      }
    }

    return completion;
  }

  private *executeSwitch(
    statement: t.SwitchStatement,
    environment: Environment,
  ): Generator<ExecutionPoint, Completion, void> {
    const discriminant = yield* this.evaluate(statement.discriminant, environment);
    let matched = false;

    for (const switchCase of statement.cases) {
      if (!matched) {
        if (switchCase.test == null) {
          matched = true;
        } else {
          matched =
            (yield* this.evaluate(switchCase.test, environment)) === discriminant;
        }
      }

      if (!matched) continue;
      const completion = yield* this.executeStatements(
        switchCase.consequent,
        environment,
      );

      if (completion.type === "break") return NORMAL;
      if (completion.type !== "normal") return completion;
    }

    return NORMAL;
  }

  private *evaluate(
    expression: t.Expression | t.SpreadElement | t.JSXNamespacedName,
    environment: Environment,
  ): Generator<ExecutionPoint, unknown, void> {
    switch (expression.type) {
      case "NumericLiteral":
      case "StringLiteral":
      case "BooleanLiteral":
      case "DecimalLiteral":
      case "BigIntLiteral":
        return expression.value;
      case "NullLiteral":
        return null;
      case "Identifier":
        return environment.get(expression.name);
      case "ThisExpression":
        return environment.get("this");
      case "ArrayExpression": {
        const values: unknown[] = [];

        for (const element of expression.elements) {
          if (!element) {
            values.length += 1;
          } else if (element.type === "SpreadElement") {
            values.push(...Array.from((yield* this.evaluate(element.argument, environment)) as Iterable<unknown>));
          } else {
            values.push(yield* this.evaluate(element, environment));
          }
        }

        return values;
      }
      case "ObjectExpression": {
        const object: Record<PropertyKey, unknown> = {};

        for (const property of expression.properties) {
          if (property.type === "SpreadElement") {
            Object.assign(object, yield* this.evaluate(property.argument, environment));
            continue;
          }

          if (property.type === "ObjectMethod") {
            const key = propertyKey(property.key, property.computed);
            object[key] = this.createUserFunction(property, environment, String(key));
            continue;
          }

          const computed = property.computed
            ? yield* this.evaluate(property.key as t.Expression, environment)
            : undefined;
          const key = propertyKey(property.key, property.computed, computed);
          object[key] = yield* this.evaluate(property.value as t.Expression, environment);
        }

        return object;
      }
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        return this.createUserFunction(expression, environment);
      case "UnaryExpression":
        return yield* this.evaluateUnary(expression, environment);
      case "BinaryExpression":
        return yield* this.evaluateBinary(expression, environment);
      case "LogicalExpression": {
        const left = yield* this.evaluate(expression.left, environment);

        if (expression.operator === "&&") {
          return left ? yield* this.evaluate(expression.right, environment) : left;
        }
        if (expression.operator === "||") {
          return left ? left : yield* this.evaluate(expression.right, environment);
        }
        return left ?? (yield* this.evaluate(expression.right, environment));
      }
      case "ConditionalExpression":
        return (yield* this.evaluate(expression.test, environment))
          ? yield* this.evaluate(expression.consequent, environment)
          : yield* this.evaluate(expression.alternate, environment);
      case "SequenceExpression": {
        let value: unknown;

        for (const item of expression.expressions) {
          value = yield* this.evaluate(item, environment);
        }

        return value;
      }
      case "AssignmentExpression": {
        const reference = yield* this.resolveReference(expression.left, environment);
        const right = yield* this.evaluate(expression.right, environment);
        return reference.set(
          this.assignmentValue(expression.operator, reference.get(), right),
        );
      }
      case "UpdateExpression": {
        const reference = yield* this.resolveReference(
          expression.argument,
          environment,
        );
        const previous = Number(reference.get());
        const next = expression.operator === "++" ? previous + 1 : previous - 1;
        reference.set(next);
        return expression.prefix ? next : previous;
      }
      case "MemberExpression":
      case "OptionalMemberExpression": {
        const reference = yield* this.resolveReference(expression, environment);
        return reference.get();
      }
      case "CallExpression":
      case "OptionalCallExpression":
        return yield* this.evaluateCall(expression, environment);
      case "NewExpression": {
        const constructor = yield* this.evaluate(expression.callee as t.Expression, environment);
        const args = yield* this.evaluateArguments(expression.arguments, environment);

        if (isUserFunction(constructor) || typeof constructor !== "function") {
          throw new TypeError("Value is not a supported constructor");
        }

        return Reflect.construct(constructor, args);
      }
      case "TemplateLiteral": {
        let result = expression.quasis[0]?.value.cooked ?? "";

        for (let index = 0; index < expression.expressions.length; index += 1) {
          result += String(
            yield* this.evaluate(
              expression.expressions[index]! as t.Expression,
              environment,
            ),
          );
          result += expression.quasis[index + 1]?.value.cooked ?? "";
        }

        return result;
      }
      case "TaggedTemplateExpression": {
        const tag = yield* this.evaluate(expression.tag, environment);

        if (typeof tag !== "function") throw new TypeError("Tag is not callable");
        const strings = expression.quasi.quasis.map((item) => item.value.cooked ?? "");
        const values: unknown[] = [];

        for (const item of expression.quasi.expressions) {
          values.push(yield* this.evaluate(item as t.Expression, environment));
        }

        return tag(strings, ...values);
      }
      case "TSAsExpression":
      case "TSTypeAssertion":
      case "TSNonNullExpression":
      case "TSInstantiationExpression":
      case "TypeCastExpression":
        return yield* this.evaluate(expression.expression, environment);
      case "AwaitExpression":
        return yield* this.evaluate(expression.argument, environment);
      default:
        throw new SyntaxError(`Unsupported expression: ${expression.type}`);
    }
  }

  private *evaluateCall(
    expression: t.CallExpression | t.OptionalCallExpression,
    environment: Environment,
  ): Generator<ExecutionPoint, unknown, void> {
    let callable: unknown;
    let thisValue: unknown = undefined;

    if (
      expression.callee.type === "MemberExpression" ||
      expression.callee.type === "OptionalMemberExpression"
    ) {
      const object = yield* this.evaluate(expression.callee.object as t.Expression, environment);

      if (object == null && expression.optional) return undefined;
      const computed = expression.callee.computed
        ? yield* this.evaluate(expression.callee.property as t.Expression, environment)
        : undefined;
      const key = propertyKey(
        expression.callee.property,
        expression.callee.computed,
        computed,
      );
      thisValue = object;
      callable = (object as Record<PropertyKey, unknown>)[key];
    } else {
      callable = yield* this.evaluate(expression.callee as t.Expression, environment);
    }

    if (callable == null && expression.optional) return undefined;
    const args = yield* this.evaluateArguments(expression.arguments, environment);

    if (isUserFunction(callable)) {
      return yield* this.callUserFunction(callable, args, thisValue, expression.loc);
    }

    if (typeof callable !== "function") {
      throw new TypeError("Value is not callable");
    }

    if (args.some(isUserFunction)) {
      throw new TypeError(
        "Passing interpreted functions to native callbacks is not supported; use a loop for this lesson",
      );
    }

    return Reflect.apply(callable, thisValue, args);
  }

  private *evaluateArguments(
    argumentsList: readonly (t.Expression | t.JSXNamespacedName | t.SpreadElement | t.ArgumentPlaceholder)[],
    environment: Environment,
  ): Generator<ExecutionPoint, unknown[], void> {
    const args: unknown[] = [];

    for (const argument of argumentsList) {
      if (argument.type === "ArgumentPlaceholder" || argument.type === "JSXNamespacedName") {
        throw new SyntaxError(`Unsupported argument: ${argument.type}`);
      }

      if (argument.type === "SpreadElement") {
        args.push(...Array.from((yield* this.evaluate(argument.argument, environment)) as Iterable<unknown>));
      } else {
        args.push(yield* this.evaluate(argument, environment));
      }
    }

    return args;
  }

  private *callUserFunction(
    callable: UserFunction,
    args: unknown[],
    thisValue: unknown,
    callSite?: t.SourceLocation | null,
  ): Generator<ExecutionPoint, unknown, void> {
    const environment = new Environment(`Local: ${callable.name}`, callable.closure);
    environment.define("this", thisValue, "param");

    callable.node.params.forEach((parameter, index) => {
      this.bindPattern(parameter, args[index], environment, "param");
    });

    environment.define("arguments", args, "param");
    this.pushFrame(callable.name, environment, callSite);

    try {
      if (callable.node.body.type === "BlockStatement") {
        const completion = yield* this.executeStatements(
          callable.node.body.body,
          environment,
        );
        return completion.type === "return" ? completion.value : undefined;
      }

      yield this.point(callable.node.body, environment);
      return yield* this.evaluate(callable.node.body, environment);
    } finally {
      this.frames.pop();
    }
  }

  private createUserFunction(
    node: UserFunction["node"],
    closure: Environment,
    fallbackName = "<anonymous>",
  ): UserFunction {
    if (node.async || node.generator) {
      throw new SyntaxError(
        "Async functions and generators are not yet supported by the teaching runtime",
      );
    }

    const name =
      "id" in node && node.id?.type === "Identifier"
        ? node.id.name
        : fallbackName;

    return { closure, name, node, type: "user-function" };
  }

  private *resolveReference(
    expression: t.Expression | t.LVal | t.OptionalMemberExpression,
    environment: Environment,
  ): Generator<ExecutionPoint, Reference, void> {
    if (expression.type === "Identifier") {
      return {
        get: () => environment.get(expression.name),
        set: (value) => environment.set(expression.name, value),
      };
    }

    if (
      expression.type === "MemberExpression" ||
      expression.type === "OptionalMemberExpression"
    ) {
      const object = yield* this.evaluate(expression.object as t.Expression, environment);
      const computed = expression.computed
        ? yield* this.evaluate(expression.property as t.Expression, environment)
        : undefined;
      const key = propertyKey(expression.property, expression.computed, computed);

      return {
        get: () => (object as Record<PropertyKey, unknown>)[key],
        set: (value) => {
          (object as Record<PropertyKey, unknown>)[key] = value;
          return value;
        },
      };
    }

    throw new SyntaxError(`Unsupported assignment target: ${expression.type}`);
  }

  private *evaluateUnary(
    expression: t.UnaryExpression,
    environment: Environment,
  ): Generator<ExecutionPoint, unknown, void> {
    if (expression.operator === "typeof" && expression.argument.type === "Identifier") {
      try {
        return typeof environment.get(expression.argument.name);
      } catch {
        return "undefined";
      }
    }

    const value = yield* this.evaluate(expression.argument, environment);

    switch (expression.operator) {
      case "+": return Number(value);
      case "-": return -Number(value);
      case "!": return !value;
      case "~": return ~Number(value);
      case "typeof": return typeof value;
      case "void": return undefined;
      case "delete": return true;
      default: throw new SyntaxError(`Unsupported unary operator: ${expression.operator}`);
    }
  }

  private *evaluateBinary(
    expression: t.BinaryExpression,
    environment: Environment,
  ): Generator<ExecutionPoint, unknown, void> {
    if (expression.left.type === "PrivateName") {
      throw new SyntaxError("Private-name checks are not supported");
    }

    const left = yield* this.evaluate(expression.left, environment);
    const right = yield* this.evaluate(expression.right, environment);

    switch (expression.operator) {
      case "+": return (left as never) + (right as never);
      case "-": return Number(left) - Number(right);
      case "*": return Number(left) * Number(right);
      case "/": return Number(left) / Number(right);
      case "%": return Number(left) % Number(right);
      case "**": return Number(left) ** Number(right);
      case "<": return (left as never) < (right as never);
      case "<=": return (left as never) <= (right as never);
      case ">": return (left as never) > (right as never);
      case ">=": return (left as never) >= (right as never);
      case "==": return left == right;
      case "!=": return left != right;
      case "===": return left === right;
      case "!==": return left !== right;
      case "|": return Number(left) | Number(right);
      case "&": return Number(left) & Number(right);
      case "^": return Number(left) ^ Number(right);
      case "<<": return Number(left) << Number(right);
      case ">>": return Number(left) >> Number(right);
      case ">>>": return Number(left) >>> Number(right);
      case "in": return left as PropertyKey in Object(right);
      case "instanceof": return left instanceof (right as Function);
      default: throw new SyntaxError(`Unsupported binary operator: ${expression.operator}`);
    }
  }

  private assignmentValue(
    operator: t.AssignmentExpression["operator"],
    left: unknown,
    right: unknown,
  ): unknown {
    switch (operator) {
      case "=": return right;
      case "+=": return (left as never) + (right as never);
      case "-=": return Number(left) - Number(right);
      case "*=": return Number(left) * Number(right);
      case "/=": return Number(left) / Number(right);
      case "%=": return Number(left) % Number(right);
      case "**=": return Number(left) ** Number(right);
      case "&&=": return left && right;
      case "||=": return left || right;
      case "??=": return left ?? right;
      case "|=": return Number(left) | Number(right);
      case "&=": return Number(left) & Number(right);
      case "^=": return Number(left) ^ Number(right);
      case "<<=": return Number(left) << Number(right);
      case ">>=": return Number(left) >> Number(right);
      case ">>>=": return Number(left) >>> Number(right);
      default: throw new SyntaxError(`Unsupported assignment operator: ${operator}`);
    }
  }
}
