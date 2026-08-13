import type { Token } from './lexer';
import { Lexer, TokenType } from './lexer';
import * as AST from './ast';

export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(input: string) {
    const lexer = new Lexer(input);
    this.tokens = lexer.tokenize();
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private check(type: TokenType, value?: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    if (token.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    return true;
  }

  private match(type: TokenType, value?: string): boolean {
    if (this.check(type, value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: TokenType, message: string, value?: string): Token {
    if (this.check(type, value)) return this.advance();
    throw new Error(`${message} at line ${this.peek().line}, col ${this.peek().column}`);
  }

  public parse(): AST.Program {
    const body: AST.Statement[] = [];
    while (!this.isAtEnd()) {
      body.push(this.parseStatement());
    }
    return {
      type: 'Program',
      pos: { line: 1, column: 1 },
      body,
    };
  }

  private parseStatement(): AST.Statement {
    if (this.match(TokenType.Keyword, 'fn')) return this.parseFunctionDeclaration();
    if (this.match(TokenType.Keyword, 'var')) return this.parseVariableDeclaration();
    if (this.match(TokenType.Keyword, 'if')) return this.parseIfStatement();
    if (this.match(TokenType.Keyword, 'while')) return this.parseWhileStatement();
    if (this.match(TokenType.Keyword, 'return')) return this.parseReturnStatement();
    if (this.match(TokenType.Keyword, 'free')) return this.parseFreeStatement();
    if (this.match(TokenType.Keyword, 'try')) return this.parseTryStatement();
    if (this.match(TokenType.Keyword, 'class')) return this.parseClassDeclaration();
    
    // Block statement
    if (this.check(TokenType.Punctuation, '{')) return this.parseBlockStatement();

    return this.parseExpressionStatement();
  }

  private parseFunctionDeclaration(): AST.FunctionDeclaration {
    const pos = this.previous();
    const nameToken = this.consume(TokenType.Identifier, 'Expect function name.');
    
    this.consume(TokenType.Punctuation, 'Expect "(" after function name.', '(');
    const params: AST.Identifier[] = [];
    if (!this.check(TokenType.Punctuation, ')')) {
      do {
        const paramToken = this.consume(TokenType.Identifier, 'Expect parameter name.');
        params.push({ type: 'Identifier', name: paramToken.value, pos: { line: paramToken.line, column: paramToken.column } });
      } while (this.match(TokenType.Punctuation, ','));
    }
    this.consume(TokenType.Punctuation, 'Expect ")" after parameters.', ')');

    const body = this.parseBlockStatement();

    return {
      type: 'FunctionDeclaration',
      pos: { line: pos.line, column: pos.column },
      name: { type: 'Identifier', name: nameToken.value, pos: { line: nameToken.line, column: nameToken.column } },
      params,
      body,
    };
  }

  private parseClassDeclaration(): AST.ClassDeclaration {
    const pos = this.previous();
    const nameToken = this.consume(TokenType.Identifier, 'Expect class name.');
    const body = this.parseBlockStatement();
    return {
      type: 'ClassDeclaration',
      pos: { line: pos.line, column: pos.column },
      name: { type: 'Identifier', name: nameToken.value, pos: { line: nameToken.line, column: nameToken.column } },
      body,
    };
  }

  private parseVariableDeclaration(): AST.VariableDeclaration {
    const pos = this.previous();
    const nameToken = this.consume(TokenType.Identifier, 'Expect variable name.');
    this.consume(TokenType.Operator, 'Expect "=" after variable name.', '=');
    const init = this.parseExpression();
    this.consume(TokenType.Punctuation, 'Expect ";" after variable declaration.', ';');
    return {
      type: 'VariableDeclaration',
      pos: { line: pos.line, column: pos.column },
      name: { type: 'Identifier', name: nameToken.value, pos: { line: nameToken.line, column: nameToken.column } },
      init,
    };
  }

  private parseIfStatement(): AST.IfStatement {
    const pos = this.previous();
    this.consume(TokenType.Punctuation, 'Expect "(" after "if".', '(');
    const condition = this.parseExpression();
    this.consume(TokenType.Punctuation, 'Expect ")" after if condition.', ')');
    
    const consequent = this.parseBlockStatement();
    let alternate: AST.BlockStatement | AST.IfStatement | undefined = undefined;

    if (this.match(TokenType.Keyword, 'else')) {
      if (this.match(TokenType.Keyword, 'if')) {
        alternate = this.parseIfStatement();
      } else {
        alternate = this.parseBlockStatement();
      }
    }

    return {
      type: 'IfStatement',
      pos: { line: pos.line, column: pos.column },
      condition,
      consequent,
      alternate,
    };
  }

  private parseWhileStatement(): AST.WhileStatement {
    const pos = this.previous();
    this.consume(TokenType.Punctuation, 'Expect "(" after "while".', '(');
    const condition = this.parseExpression();
    this.consume(TokenType.Punctuation, 'Expect ")" after while condition.', ')');
    const body = this.parseBlockStatement();
    
    return {
      type: 'WhileStatement',
      pos: { line: pos.line, column: pos.column },
      condition,
      body,
    };
  }

  private parseReturnStatement(): AST.ReturnStatement {
    const pos = this.previous();
    let argument: AST.Expression | null = null;
    if (!this.check(TokenType.Punctuation, ';')) {
      argument = this.parseExpression();
    }
    this.consume(TokenType.Punctuation, 'Expect ";" after return value.', ';');
    return {
      type: 'ReturnStatement',
      pos: { line: pos.line, column: pos.column },
      argument,
    };
  }

  private parseFreeStatement(): AST.FreeStatement {
    const pos = this.previous();
    this.consume(TokenType.Punctuation, 'Expect "(" after "free".', '(');
    const pointer = this.parseExpression();
    this.consume(TokenType.Punctuation, 'Expect ")" after free expression.', ')');
    this.consume(TokenType.Punctuation, 'Expect ";" after free statement.', ';');
    return {
      type: 'FreeStatement',
      pos: { line: pos.line, column: pos.column },
      pointer,
    };
  }

  private parseTryStatement(): AST.TryStatement {
    const pos = this.previous();
    const block = this.parseBlockStatement();
    this.consume(TokenType.Keyword, 'Expect "catch" after try block.', 'catch');
    const handler = this.parseBlockStatement();
    return {
      type: 'TryStatement',
      pos: { line: pos.line, column: pos.column },
      block,
      handler,
    };
  }

  private parseBlockStatement(): AST.BlockStatement {
    const pos = this.peek();
    this.consume(TokenType.Punctuation, 'Expect "{" before block.', '{');
    const body: AST.Statement[] = [];
    while (!this.check(TokenType.Punctuation, '}') && !this.isAtEnd()) {
      body.push(this.parseStatement());
    }
    this.consume(TokenType.Punctuation, 'Expect "}" after block.', '}');
    return {
      type: 'BlockStatement',
      pos: { line: pos.line, column: pos.column },
      body,
    };
  }

  private parseExpressionStatement(): AST.ExpressionStatement {
    const expr = this.parseExpression();
    this.consume(TokenType.Punctuation, 'Expect ";" after expression.', ';');
    return {
      type: 'ExpressionStatement',
      pos: expr.pos,
      expression: expr,
    };
  }

  private parseExpression(): AST.Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): AST.Expression {
    const expr = this.parseEquality();

    if (this.match(TokenType.Operator, '=')) {
      const equals = this.previous();
      const value = this.parseAssignment();

      if (expr.type === 'Identifier' || expr.type === 'IndexExpression' || expr.type === 'MemberExpression') {
        return {
          type: 'AssignmentExpression',
          pos: expr.pos,
          left: expr as AST.Identifier | AST.IndexExpression | AST.MemberExpression,
          right: value,
        };
      }

      throw new Error(`Invalid assignment target at line ${equals.line}, col ${equals.column}`);
    }

    return expr;
  }

  private parseEquality(): AST.Expression {
    let expr = this.parseComparison();

    while (this.match(TokenType.Operator, '==') || this.match(TokenType.Operator, '!=')) {
      const operator = this.previous();
      const right = this.parseComparison();
      expr = {
        type: 'BinaryExpression',
        pos: expr.pos,
        operator: operator.value as AST.BinaryOperator,
        left: expr,
        right,
      };
    }

    return expr;
  }

  private parseComparison(): AST.Expression {
    let expr = this.parseTerm();

    while (
      this.match(TokenType.Operator, '<') ||
      this.match(TokenType.Operator, '<=') ||
      this.match(TokenType.Operator, '>') ||
      this.match(TokenType.Operator, '>=')
    ) {
      const operator = this.previous();
      const right = this.parseTerm();
      expr = {
        type: 'BinaryExpression',
        pos: expr.pos,
        operator: operator.value as AST.BinaryOperator,
        left: expr,
        right,
      };
    }

    return expr;
  }

  private parseTerm(): AST.Expression {
    let expr = this.parseFactor();

    while (this.match(TokenType.Operator, '+') || this.match(TokenType.Operator, '-')) {
      const operator = this.previous();
      const right = this.parseFactor();
      expr = {
        type: 'BinaryExpression',
        pos: expr.pos,
        operator: operator.value as AST.BinaryOperator,
        left: expr,
        right,
      };
    }

    return expr;
  }

  private parseFactor(): AST.Expression {
    let expr = this.parsePrimary();

    while (this.match(TokenType.Operator, '*') || this.match(TokenType.Operator, '/')) {
      const operator = this.previous();
      const right = this.parsePrimary();
      expr = {
        type: 'BinaryExpression',
        pos: expr.pos,
        operator: operator.value as AST.BinaryOperator,
        left: expr,
        right,
      };
    }

    return expr;
  }

  private parsePrimary(): AST.Expression {
    if (this.match(TokenType.Boolean, 'false')) return { type: 'Literal', value: false, pos: { line: this.previous().line, column: this.previous().column } };
    if (this.match(TokenType.Boolean, 'true')) return { type: 'Literal', value: true, pos: { line: this.previous().line, column: this.previous().column } };
    
    if (this.match(TokenType.Number)) {
      return { type: 'Literal', value: parseFloat(this.previous().value), pos: { line: this.previous().line, column: this.previous().column } };
    }

    if (this.match(TokenType.String)) {
      return { type: 'Literal', value: this.previous().value, pos: { line: this.previous().line, column: this.previous().column } };
    }

    if (this.match(TokenType.Keyword, 'alloc')) {
      const pos = this.previous();
      this.consume(TokenType.Punctuation, 'Expect "(" after alloc.', '(');
      const size = this.parseExpression();
      this.consume(TokenType.Punctuation, 'Expect ")" after alloc size.', ')');
      return {
        type: 'AllocExpression',
        pos: { line: pos.line, column: pos.column },
        size,
      };
    }

    if (this.match(TokenType.Keyword, 'new')) {
      const pos = this.previous();
      const callee = this.consume(TokenType.Identifier, 'Expect class name after "new".');
      this.consume(TokenType.Punctuation, 'Expect "(" after class name.', '(');
      const args: AST.Expression[] = [];
      if (!this.check(TokenType.Punctuation, ')')) {
        do {
          args.push(this.parseExpression());
        } while (this.match(TokenType.Punctuation, ','));
      }
      this.consume(TokenType.Punctuation, 'Expect ")" after arguments.', ')');
      return {
        type: 'NewExpression',
        pos: { line: pos.line, column: pos.column },
        callee: { type: 'Identifier', name: callee.value, pos: { line: callee.line, column: callee.column } },
        args,
      };
    }

    if (this.match(TokenType.Identifier) || this.match(TokenType.Keyword, 'this')) {
      let node: AST.Expression = { type: 'Identifier', name: this.previous().value, pos: { line: this.previous().line, column: this.previous().column } };
      
      while (true) {
        if (this.match(TokenType.Punctuation, '(')) {
          const args: AST.Expression[] = [];
          if (!this.check(TokenType.Punctuation, ')')) {
            do {
              args.push(this.parseExpression());
            } while (this.match(TokenType.Punctuation, ','));
          }
          this.consume(TokenType.Punctuation, 'Expect ")" after arguments.', ')');
          node = {
            type: 'CallExpression',
            pos: node.pos,
            callee: node as AST.Identifier, // Cast is a bit loose but works for AST structure
            args,
          };
        } else if (this.match(TokenType.Punctuation, '[')) {
          const index = this.parseExpression();
          this.consume(TokenType.Punctuation, 'Expect "]" after index.', ']');
          node = {
            type: 'IndexExpression',
            pos: node.pos,
            object: node,
            index,
          };
        } else if (this.match(TokenType.Punctuation, '.')) {
          const property = this.consume(TokenType.Identifier, 'Expect property name after ".".');
          node = {
            type: 'MemberExpression',
            pos: node.pos,
            object: node,
            property: { type: 'Identifier', name: property.value, pos: { line: property.line, column: property.column } },
          };
        } else {
          break;
        }
      }

      return node;
    }

    if (this.match(TokenType.Punctuation, '[')) {
      const pos = this.previous();
      const elements: AST.Expression[] = [];
      if (!this.check(TokenType.Punctuation, ']')) {
        do {
          elements.push(this.parseExpression());
        } while (this.match(TokenType.Punctuation, ','));
      }
      this.consume(TokenType.Punctuation, 'Expect "]" after array elements.', ']');
      
      let node: AST.Expression = {
        type: 'ArrayLiteral',
        pos: { line: pos.line, column: pos.column },
        elements,
      };

      // Check for index expression on array literal
      while (this.match(TokenType.Punctuation, '[')) {
        const index = this.parseExpression();
        this.consume(TokenType.Punctuation, 'Expect "]" after index.', ']');
        node = {
          type: 'IndexExpression',
          pos: node.pos,
          object: node,
          index,
        };
      }
      
      return node;
    }

    if (this.match(TokenType.Punctuation, '(')) {
      const expr = this.parseExpression();
      this.consume(TokenType.Punctuation, 'Expect ")" after expression.', ')');
      return expr;
    }

    throw new Error(`Unexpected token '${this.peek().value}' at line ${this.peek().line}, col ${this.peek().column}`);
  }
}
