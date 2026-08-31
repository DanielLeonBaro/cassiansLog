// Tokenizes and evaluates bounded calculator expressions without eval().
const MAX_EXPRESSION_LENGTH = 200;

function tokenize(source) {
  const input = String(source || "").trim();
  if (!input) throw new Error("Enter a calculation.");
  if (input.length > MAX_EXPRESSION_LENGTH) throw new Error(`A calculation cannot exceed ${MAX_EXPRESSION_LENGTH} characters.`);
  const raw = [];
  let position = 0;
  while (position < input.length) {
    const character = input[position];
    if (/\s/.test(character)) { position += 1; continue; }
    if (/[+\-*/()]/.test(character)) {
      raw.push({ type: character, value: character });
      position += 1;
      continue;
    }
    if (/\d|\./.test(character)) {
      const start = position;
      let dots = 0;
      while (position < input.length && /\d|\./.test(input[position])) {
        if (input[position] === ".") dots += 1;
        position += 1;
      }
      const literal = input.slice(start, position);
      if (dots > 1 || literal === ".") throw new Error(`Invalid number at position ${start + 1}.`);
      raw.push({ type: "number", value: Number(literal) });
      continue;
    }
    throw new Error(`Unexpected "${character}" at position ${position + 1}.`);
  }
  const tokens = [];
  raw.forEach((token) => {
    const previous = tokens.at(-1);
    const previousValue = previous && (previous.type === "number" || previous.type === ")");
    const nextValue = token.type === "number" || token.type === "(";
    if (previousValue && nextValue) tokens.push({ type: "*", value: "*" });
    tokens.push(token);
  });
  return tokens;
}

class CalculatorParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  parse() {
    const value = this.expression();
    if (this.position !== this.tokens.length) throw new Error("Unexpected input after calculation.");
    if (!Number.isFinite(value)) throw new Error("The result is not a finite number.");
    return value;
  }

  expression() {
    let value = this.term();
    while (["+", "-"].includes(this.peek()?.type)) {
      const operator = this.take().type;
      const right = this.term();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  term() {
    let value = this.unary();
    while (["*", "/"].includes(this.peek()?.type)) {
      const operator = this.take().type;
      const right = this.unary();
      if (operator === "/" && right === 0) throw new Error("Cannot divide by zero.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  unary() {
    if (this.peek()?.type === "+") { this.take(); return this.unary(); }
    if (this.peek()?.type === "-") { this.take(); return -this.unary(); }
    return this.primary();
  }

  primary() {
    const token = this.take();
    if (!token) throw new Error("Calculation ended unexpectedly.");
    if (token.type === "number") return token.value;
    if (token.type === "(") {
      const value = this.expression();
      if (this.take()?.type !== ")") throw new Error('Expected ")".');
      return value;
    }
    throw new Error(`Expected a number or "(".`);
  }

  peek() { return this.tokens[this.position]; }
  take() { return this.tokens[this.position++]; }
}

export function calculateExpression(source) {
  return new CalculatorParser(tokenize(source)).parse();
}

export function formatCalculatorResult(value) {
  if (!Number.isFinite(value)) throw new Error("The result is not a finite number.");
  return String(Number(value.toPrecision(15)));
}
