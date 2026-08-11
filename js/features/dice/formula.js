const MAX_FORMULA_LENGTH = 200;
const MAX_DICE_PER_TERM = 100;
const MAX_DIE_SIDES = 100000;
const MAX_REPEATS = 100;
const MAX_TOTAL_ROLLS = 1000;
const STANDARD_DIE_SIDES = [4, 6, 8, 10, 12, 20, 100];

class FormulaParser {
  constructor(source) {
    this.source = source;
    this.position = 0;
  }

  parse() {
    const expression = this.parseExpression();
    this.skipSpaces();
    if (this.position !== this.source.length)
      this.fail(`Unexpected "${this.source[this.position]}"`);
    return expression;
  }

  parseExpression() {
    let left = this.parseTerm();
    while (true) {
      const operator = this.take("+") || this.take("-");
      if (!operator) return left;
      left = { type: "binary", operator, left, right: this.parseTerm() };
    }
  }

  parseTerm() {
    let left = this.parseUnary();
    while (true) {
      const operator = this.take("*") || this.take("/");
      if (!operator) return left;
      left = { type: "binary", operator, left, right: this.parseUnary() };
    }
  }

  parseUnary() {
    if (this.take("+")) return this.parseUnary();
    if (this.take("-"))
      return { type: "unary", operator: "-", value: this.parseUnary() };
    return this.parsePrimary();
  }

  parsePrimary() {
    this.skipSpaces();
    if (this.take("(")) {
      const expression = this.parseExpression();
      if (!this.take(")")) this.fail('Expected ")"');
      return { type: "group", value: expression };
    }

    if (this.peek().toLowerCase() === "d") {
      this.position += 1;
      return this.makeDice(1, this.readInteger("die sides"));
    }

    const value = this.readInteger("a number or dice term");
    this.skipSpaces();
    if (this.peek().toLowerCase() === "d") {
      this.position += 1;
      return this.makeDice(value, this.readInteger("die sides"));
    }
    if (this.take("(")) {
      if (value < 1 || value > MAX_REPEATS)
        this.fail(`Group repeats must be between 1 and ${MAX_REPEATS}`);
      const expression = this.parseExpression();
      if (!this.take(")")) this.fail('Expected ")"');
      return { type: "repeat", count: value, value: expression };
    }
    return { type: "number", value };
  }

  makeDice(count, sides) {
    if (count < 1 || count > MAX_DICE_PER_TERM)
      this.fail(`Dice count must be between 1 and ${MAX_DICE_PER_TERM}`);
    if (sides < 2 || sides > MAX_DIE_SIDES)
      this.fail(`Die sides must be between 2 and ${MAX_DIE_SIDES}`);
    return { type: "dice", count, sides };
  }

  readInteger(label) {
    this.skipSpaces();
    const start = this.position;
    while (/\d/.test(this.peek())) this.position += 1;
    if (start === this.position) this.fail(`Expected ${label}`);
    return Number(this.source.slice(start, this.position));
  }

  take(character) {
    this.skipSpaces();
    if (this.source[this.position] !== character) return "";
    this.position += 1;
    return character;
  }

  peek() {
    return this.source[this.position] || "";
  }

  skipSpaces() {
    while (/\s/.test(this.peek())) this.position += 1;
  }

  fail(message) {
    throw new Error(`${message} at position ${this.position + 1}.`);
  }
}

function text(value, tone = "normal") {
  return { text: String(value), tone };
}

function evaluateNode(node, rollDie, budget) {
  if (node.type === "number")
    return { total: node.value, parts: [text(node.value)] };

  if (node.type === "dice") {
    const rolls = [];
    for (let index = 0; index < node.count; index += 1) {
      budget.count += 1;
      if (budget.count > MAX_TOTAL_ROLLS)
        throw new Error(`A formula cannot roll more than ${MAX_TOTAL_ROLLS} dice.`);
      const result = Number(rollDie(node.sides));
      if (!Number.isInteger(result) || result < 1 || result > node.sides)
        throw new Error(`The dice roller returned an invalid d${node.sides} result.`);
      rolls.push(result);
    }
    const parts = [];
    if (rolls.length > 1) parts.push(text("("));
    rolls.forEach((roll, index) => {
      if (index) parts.push(text(" + "));
      parts.push(text(roll, roll === 1 ? "minimum" : roll === node.sides ? "maximum" : "normal"));
    });
    if (rolls.length > 1) parts.push(text(")"));
    return { total: rolls.reduce((sum, roll) => sum + roll, 0), parts };
  }

  if (node.type === "group") {
    const result = evaluateNode(node.value, rollDie, budget);
    return { total: result.total, parts: [text("("), ...result.parts, text(")")] };
  }

  if (node.type === "repeat") {
    const results = Array.from({ length: node.count }, () =>
      evaluateNode(node.value, rollDie, budget),
    );
    return {
      total: results.reduce((sum, result) => sum + result.total, 0),
      parts: results.flatMap((result, index) => [
        ...(index ? [text(" + ")] : []),
        text("("),
        ...result.parts,
        text(")"),
      ]),
    };
  }

  if (node.type === "unary") {
    const result = evaluateNode(node.value, rollDie, budget);
    return { total: -result.total, parts: [text("-"), ...result.parts] };
  }

  const left = evaluateNode(node.left, rollDie, budget);
  const right = evaluateNode(node.right, rollDie, budget);
  let total;
  if (node.operator === "+") total = left.total + right.total;
  else if (node.operator === "-") total = left.total - right.total;
  else if (node.operator === "*") total = left.total * right.total;
  else {
    if (right.total === 0) throw new Error("Cannot divide by zero.");
    total = left.total / right.total;
  }
  const operator = node.operator === "*" ? "×" : node.operator === "/" ? "÷" : node.operator;
  return {
    total,
    parts: [...left.parts, text(` ${operator} `), ...right.parts],
  };
}

export function parseDiceFormula(source) {
  const formula = String(source || "").trim();
  if (!formula) throw new Error("Enter a dice formula.");
  if (formula.length > MAX_FORMULA_LENGTH)
    throw new Error(`A formula cannot exceed ${MAX_FORMULA_LENGTH} characters.`);
  return new FormulaParser(formula).parse();
}

export function rollDiceFormula(source, rollDie = (sides) => Math.floor(Math.random() * sides) + 1) {
  return evaluateNode(parseDiceFormula(source), rollDie, { count: 0 });
}

export function appendDieToFormula(source, sides) {
  const die = Number(sides);
  if (!STANDARD_DIE_SIDES.includes(die)) throw new Error("Unsupported die size.");
  const formula = String(source || "").trim();
  if (!formula) return `1d${die}`;
  const separator = /[+\-*/(]$/.test(formula) ? "" : "+";
  return `${formula}${separator}1d${die}`;
}
