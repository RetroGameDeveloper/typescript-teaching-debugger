import type { BindingKind, ScopeSnapshot } from "./types";

interface Binding {
  kind: BindingKind;
  value: unknown;
}

export class Environment {
  readonly bindings = new Map<string, Binding>();

  constructor(
    readonly name: string,
    readonly parent?: Environment,
    readonly hidden = false,
  ) {}

  define(name: string, value: unknown, kind: BindingKind): void {
    if (this.bindings.has(name) && kind !== "var") {
      throw new SyntaxError(`Identifier "${name}" has already been declared`);
    }

    this.bindings.set(name, { kind, value });
  }

  get(name: string): unknown {
    const binding = this.bindings.get(name);

    if (binding) {
      return binding.value;
    }

    if (this.parent) {
      return this.parent.get(name);
    }

    throw new ReferenceError(`${name} is not defined`);
  }

  set(name: string, value: unknown): unknown {
    const binding = this.bindings.get(name);

    if (binding) {
      if (binding.kind === "const" || binding.kind === "function") {
        throw new TypeError(`Assignment to constant variable "${name}"`);
      }

      binding.value = value;
      return value;
    }

    if (this.parent) {
      return this.parent.set(name, value);
    }

    throw new ReferenceError(`${name} is not defined`);
  }

  snapshots(): ScopeSnapshot[] {
    const snapshots: ScopeSnapshot[] = [];
    let environment: Environment | undefined = this;

    while (environment) {
      if (!environment.hidden && environment.bindings.size > 0) {
        snapshots.push({
          name: environment.name,
          entries: [...environment.bindings.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, binding]) => ({ name, ...binding })),
        });
      }

      environment = environment.parent;
    }

    return snapshots;
  }
}
