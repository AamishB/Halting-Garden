export const TokenType = {
  Keyword: 'Keyword' as const,
  Identifier: 'Identifier' as const,
  Number: 'Number' as const,
  String: 'String' as const,
  Boolean: 'Boolean' as const,
  Operator: 'Operator' as const,
  Punctuation: 'Punctuation' as const,
  EOF: 'EOF' as const,
};

export type TokenType = typeof TokenType[keyof typeof TokenType];

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS = new Set(['fn', 'var', 'if', 'else', 'while', 'return', 'alloc', 'free', 'true', 'false', 'try', 'catch', 'class', 'new', 'this']);

export class Lexer {
  private pos = 0;
  private line = 1;
  private column = 1;
  private input: string;

  constructor(input: string) {
    this.input = input;
  }

  private advance(): string {
    if (this.isAtEnd()) return '';
    const char = this.input[this.pos++];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private peek(): string {
    if (this.isAtEnd()) return '';
    return this.input[this.pos];
  }

  private isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  private skipWhitespace() {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\r' || char === '\t' || char === '\n') {
        this.advance();
      } else if (char === '/' && this.input[this.pos + 1] === '/') {
        // Line comment
        while (!this.isAtEnd() && this.peek() !== '\n') {
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  public nextToken(): Token {
    this.skipWhitespace();

    if (this.isAtEnd()) {
      return { type: TokenType.EOF, value: '', line: this.line, column: this.column };
    }

    const startLine = this.line;
    const startColumn = this.column;
    const char = this.peek();

    // Punctuation
    if ('(){}[],;.'.includes(char)) {
      this.advance();
      return { type: TokenType.Punctuation, value: char, line: startLine, column: startColumn };
    }

    // Operators
    if ('+-*/=<>!'.includes(char)) {
      let value = this.advance();
      const nextChar = this.peek();
      if (value === '=' && nextChar === '=') {
        value += this.advance();
      } else if (value === '!' && nextChar === '=') {
        value += this.advance();
      } else if (value === '<' && nextChar === '=') {
        value += this.advance();
      } else if (value === '>' && nextChar === '=') {
        value += this.advance();
      }
      return { type: TokenType.Operator, value, line: startLine, column: startColumn };
    }

    // Strings
    if (char === '"' || char === "'") {
      const quote = this.advance();
      let value = '';
      while (!this.isAtEnd() && this.peek() !== quote) {
        value += this.advance();
      }
      if (!this.isAtEnd()) this.advance(); // consume closing quote
      return { type: TokenType.String, value, line: startLine, column: startColumn };
    }

    // Numbers
    if (/[0-9]/.test(char)) {
      let value = '';
      while (!this.isAtEnd() && /[0-9.]/.test(this.peek())) {
        value += this.advance();
      }
      return { type: TokenType.Number, value, line: startLine, column: startColumn };
    }

    // Identifiers and Keywords
    if (/[a-zA-Z_]/.test(char)) {
      let value = '';
      while (!this.isAtEnd() && /[a-zA-Z0-9_]/.test(this.peek())) {
        value += this.advance();
      }
      if (KEYWORDS.has(value)) {
        if (value === 'true' || value === 'false') {
          return { type: TokenType.Boolean, value, line: startLine, column: startColumn };
        }
        return { type: TokenType.Keyword, value, line: startLine, column: startColumn };
      }
      return { type: TokenType.Identifier, value, line: startLine, column: startColumn };
    }

    // Fallback error (should throw in real lexer, returning unknown token for now)
    const badChar = this.advance();
    throw new Error(`Unexpected character '${badChar}' at line ${startLine}, col ${startColumn}`);
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();
    while (token.type !== TokenType.EOF) {
      tokens.push(token);
      token = this.nextToken();
    }
    tokens.push(token); // EOF
    return tokens;
  }
}
