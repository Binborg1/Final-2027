import assert from "node:assert/strict";
import { test } from "node:test";
import { compileExpr, evalExpr, ExprError, exprVariables, fillTemplate, isIdentifier, parseExpr, resolveNumber } from "@/lib/visualizations/expr";

const calc = (src: string, vars: Record<string, number> = {}) => evalExpr(parseExpr(src), vars);

test("arithmetic follows the usual precedence and associativity", () => {
  assert.equal(calc("2 + 3 * 4"), 14);
  assert.equal(calc("(2 + 3) * 4"), 20);
  assert.equal(calc("-2^2"), -4);
  assert.equal(calc("2^3^2"), 512);
  assert.equal(calc("10 % 4"), 2);
  assert.equal(calc("7 / 2"), 3.5);
  assert.equal(calc("2e3 + .5"), 2000.5);
  assert.equal(calc("--3"), 3);
});

test("the function and constant whitelist works, and nothing else is callable", () => {
  assert.equal(calc("sqrt(16) + abs(-3)"), 7);
  assert.equal(calc("max(1, 5, 3) - min(4, 2)"), 3);
  assert.equal(calc("round(2.4) + floor(2.9) + ceil(2.1)"), 7);
  assert.equal(calc("pow(2, 10)"), 1024);
  assert.ok(Math.abs(calc("sin(pi / 2)") - 1) < 1e-12);
  assert.ok(Math.abs(calc("ln(e)") - 1) < 1e-12);
  assert.throws(() => parseExpr("alert(1)"), ExprError);
  assert.throws(() => parseExpr("eval(1)"), ExprError);
  assert.throws(() => parseExpr("sqrt(1, 2)"), ExprError, "wrong arity is rejected");
  assert.throws(() => parseExpr("window.alert(1)"), ExprError);
  assert.throws(() => parseExpr("a => b"), ExprError);
  assert.throws(() => parseExpr("a; b"), ExprError);
  assert.throws(() => parseExpr("1 +"), ExprError);
  assert.throws(() => parseExpr("(1 + 2"), ExprError);
  assert.throws(() => parseExpr(""), ExprError);
});

test("variables are only the ones the caller allows", () => {
  const f = compileExpr("a*x^2 + b*x + c", ["a", "b", "c", "x"]);
  assert.equal(f({ a: 1, b: -2, c: -3, x: 3 }), 0);
  assert.throws(() => compileExpr("y + 1", ["x"]), ExprError);
  assert.throws(() => compileExpr("constructor", ["x"]), ExprError);
  assert.throws(() => compileExpr("__proto__ + 1", ["x"]), ExprError);
  assert.deepEqual([...exprVariables(parseExpr("a * pi + sqrt(b)"))].sort(), ["a", "b"]);
  assert.ok(Number.isNaN(calc("q + 1")), "an unknown variable evaluates to NaN rather than throwing at render time");
});

test("expressions are bounded in length and depth", () => {
  assert.throws(() => parseExpr("1+".repeat(150) + "1"), ExprError);
  assert.throws(() => parseExpr("(".repeat(40) + "1" + ")".repeat(40)), ExprError);
  assert.doesNotThrow(() => parseExpr("(".repeat(10) + "1" + ")".repeat(10)));
});

test("identifiers for parameters are short names that do not shadow functions or constants", () => {
  assert.equal(isIdentifier("a"), true);
  assert.equal(isIdentifier("x_1"), true);
  assert.equal(isIdentifier("sqrt"), false);
  assert.equal(isIdentifier("pi"), false);
  assert.equal(isIdentifier("1a"), false);
  assert.equal(isIdentifier("a".repeat(21)), false);
  assert.equal(isIdentifier(""), false);
});

test("templates fill {formulas} and leave anything else alone", () => {
  assert.equal(fillTemplate("x = {a + b}, raw {bad text here}, and {c}", { a: 1, b: 2 }), "x = 3, raw {bad text here}, and {c}");
  assert.equal(fillTemplate("vertex at {-b/(2*a)}", { a: 2, b: -4 }), "vertex at 1");
  assert.equal(fillTemplate("third is {1/3}", {}), "third is 0.33");
  assert.equal(fillTemplate("no braces", {}), "no braces");
  assert.equal(fillTemplate("{1/0} stays", {}), "{1/0} stays", "non-finite values are not printed");
});

test("resolveNumber accepts numbers or formulas and never throws", () => {
  assert.equal(resolveNumber(4, {}), 4);
  assert.equal(resolveNumber("2*v", { v: 3 }), 6);
  assert.ok(Number.isNaN(resolveNumber("2*", { v: 3 })));
});
