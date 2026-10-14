/**
 * A tiny, safe calculator language for visualization configs.
 *
 * Lets a lesson (or the AI) write numbers as formulas over named parameters,
 * such as "a*x^2 + b*x + c" or "-b/(2*a)", without ever executing code: the
 * text is parsed into a small tree and evaluated by hand. Only arithmetic,
 * a fixed list of functions and the variables the caller allows are accepted.
 */
export class ExprError extends Error {}

export type ExprNode =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "neg"; arg: ExprNode }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "%" | "^"; left: ExprNode; right: ExprNode }
  | { kind: "call"; fn: string; args: ExprNode[] };

const MAX_LENGTH = 200;
const MAX_DEPTH = 24;

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

const FUNCTIONS: Record<string, { arity: number | "variadic"; apply: (args: number[]) => number }> = {
  sqrt: { arity: 1, apply: ([a]) => Math.sqrt(a) },
  abs: { arity: 1, apply: ([a]) => Math.abs(a) },
  sin: { arity: 1, apply: ([a]) => Math.sin(a) },
  cos: { arity: 1, apply: ([a]) => Math.cos(a) },
  tan: { arity: 1, apply: ([a]) => Math.tan(a) },
  asin: { arity: 1, apply: ([a]) => Math.asin(a) },
  acos: { arity: 1, apply: ([a]) => Math.acos(a) },
  atan: { arity: 1, apply: ([a]) => Math.atan(a) },
  exp: { arity: 1, apply: ([a]) => Math.exp(a) },
  ln: { arity: 1, apply: ([a]) => Math.log(a) },
  log: { arity: 1, apply: ([a]) => Math.log10(a) },
  log2: { arity: 1, apply: ([a]) => Math.log2(a) },
  floor: { arity: 1, apply: ([a]) => Math.floor(a) },
  ceil: { arity: 1, apply: ([a]) => Math.ceil(a) },
  round: { arity: 1, apply: ([a]) => Math.round(a) },
  sign: { arity: 1, apply: ([a]) => Math.sign(a) },
  pow: { arity: 2, apply: ([a, b]) => Math.pow(a, b) },
  min: { arity: "variadic", apply: (args) => Math.min(...args) },
  max: { arity: "variadic", apply: (args) => Math.max(...args) },
};

export const EXPR_FUNCTIONS = Object.keys(FUNCTIONS);
export const EXPR_CONSTANTS = Object.keys(CONSTANTS);

/** Own-property lookups only, so names like "constructor" or "__proto__" never reach the prototype chain. */
const has = (table: object, name: string) => Object.prototype.hasOwnProperty.call(table, name);
const isFunction = (name: string) => has(FUNCTIONS, name);
const isConstant = (name: string) => has(CONSTANTS, name);

/** Parameter keys must look like identifiers and must not shadow a function or constant. */
export function isIdentifier(name: unknown): name is string {
  return typeof name === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,19}$/.test(name) && !isFunction(name) && !isConstant(name);
}

type Token = { type: "num"; value: number } | { type: "id"; value: string } | { type: "op"; value: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new ExprError(`Bad number at ${i}`);
      tokens.push({ type: "num", value: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      tokens.push({ type: "id", value: m[0] });
      i += m[0].length;
      continue;
    }
    if ("+-*/%^(),".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    throw new ExprError(`Unexpected "${ch}" at ${i}`);
  }
  return tokens;
}

/** Parses a formula into a tree. Throws ExprError on anything outside the grammar. */
export function parseExpr(src: string): ExprNode {
  if (typeof src !== "string" || !src.trim()) throw new ExprError("Empty expression");
  if (src.length > MAX_LENGTH) throw new ExprError("Expression too long");
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];
  const isOp = (v: string) => peek()?.type === "op" && peek().value === v;

  // `depth` counts nesting of brackets and calls; a long flat sum is fine, deep nesting is not.
  function expr(depth: number): ExprNode {
    if (depth > MAX_DEPTH) throw new ExprError("Expression too deep");
    let left = term(depth);
    while (isOp("+") || isOp("-")) {
      const op = take().value as "+" | "-";
      left = { kind: "bin", op, left, right: term(depth) };
    }
    return left;
  }
  function term(depth: number): ExprNode {
    let left = unary(depth);
    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = take().value as "*" | "/" | "%";
      left = { kind: "bin", op, left, right: unary(depth) };
    }
    return left;
  }
  function unary(depth: number): ExprNode {
    if (isOp("-")) {
      take();
      return { kind: "neg", arg: unary(depth) };
    }
    if (isOp("+")) {
      take();
      return unary(depth);
    }
    return power(depth);
  }
  function power(depth: number): ExprNode {
    const base = atom(depth);
    if (isOp("^")) {
      take();
      return { kind: "bin", op: "^", left: base, right: unary(depth) };
    }
    return base;
  }
  function atom(depth: number): ExprNode {
    const t = take();
    if (!t) throw new ExprError("Unexpected end of expression");
    if (t.type === "num") return { kind: "num", value: t.value };
    if (t.type === "id") {
      if (isOp("(")) {
        take();
        const args: ExprNode[] = [];
        if (!isOp(")")) {
          args.push(expr(depth + 1));
          while (isOp(",")) {
            take();
            args.push(expr(depth + 1));
          }
        }
        if (!isOp(")")) throw new ExprError("Missing )");
        take();
        if (!isFunction(t.value)) throw new ExprError(`Unknown function ${t.value}`);
        const fn = FUNCTIONS[t.value];
        if (fn.arity === "variadic" ? args.length < 1 : args.length !== fn.arity) throw new ExprError(`${t.value} takes ${fn.arity} argument(s)`);
        return { kind: "call", fn: t.value, args };
      }
      return { kind: "var", name: t.value };
    }
    if (t.value === "(") {
      const inner = expr(depth + 1);
      if (!isOp(")")) throw new ExprError("Missing )");
      take();
      return inner;
    }
    throw new ExprError(`Unexpected "${t.value}"`);
  }

  const tree = expr(0);
  if (pos < tokens.length) throw new ExprError(`Unexpected "${tokens[pos].value}"`);
  return tree;
}

/** The variable names a tree refers to (constants excluded). */
export function exprVariables(node: ExprNode, out = new Set<string>()): Set<string> {
  switch (node.kind) {
    case "var":
      if (!isConstant(node.name)) out.add(node.name);
      break;
    case "neg":
      exprVariables(node.arg, out);
      break;
    case "bin":
      exprVariables(node.left, out);
      exprVariables(node.right, out);
      break;
    case "call":
      node.args.forEach((a) => exprVariables(a, out));
      break;
  }
  return out;
}

export function evalExpr(node: ExprNode, vars: Record<string, number>): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "var":
      if (has(vars, node.name)) return vars[node.name];
      if (isConstant(node.name)) return CONSTANTS[node.name];
      return NaN;
    case "neg":
      return -evalExpr(node.arg, vars);
    case "bin": {
      const l = evalExpr(node.left, vars);
      const r = evalExpr(node.right, vars);
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return l / r;
        case "%":
          return l % r;
        case "^":
          return Math.pow(l, r);
      }
      return NaN;
    }
    case "call":
      if (!isFunction(node.fn)) return NaN;
      return FUNCTIONS[node.fn].apply(node.args.map((a) => evalExpr(a, vars)));
  }
}

/**
 * Parses a formula and checks it only uses `allowedVars`. Returns an evaluator.
 * Throws ExprError when the formula is malformed or names anything else.
 */
export function compileExpr(src: string, allowedVars: readonly string[]): (vars: Record<string, number>) => number {
  const tree = parseExpr(src);
  for (const name of exprVariables(tree)) {
    if (!allowedVars.includes(name)) throw new ExprError(`Unknown variable ${name}`);
  }
  return (vars) => evalExpr(tree, vars);
}

/** A number, or a formula over the allowed variables. */
export type Numberish = number | string;

/** Validates a Numberish for use with `resolveNumber`; returns it unchanged (trimmed) or throws. */
export function checkNumberish(value: unknown, allowedVars: readonly string[]): Numberish {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    compileExpr(value, allowedVars);
    return value.trim();
  }
  throw new ExprError("Expected a number or a formula");
}

export function resolveNumber(value: Numberish, vars: Record<string, number>): number {
  if (typeof value === "number") return value;
  try {
    return evalExpr(parseExpr(value), vars);
  } catch {
    return NaN;
  }
}

/** Formats a number for captions: integers as they are, otherwise up to two decimals. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "?";
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(2)));
}

/** Replaces every {formula} in a text with its value, leaving anything that does not parse untouched. */
export function fillTemplate(text: string, vars: Record<string, number>): string {
  return text.replace(/\{([^{}]{1,200})\}/g, (whole, inner: string) => {
    try {
      const value = evalExpr(parseExpr(inner), vars);
      return Number.isFinite(value) ? formatNumber(value) : whole;
    } catch {
      return whole;
    }
  });
}
