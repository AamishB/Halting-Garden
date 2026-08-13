export type Node =
  | Program
  | FunctionDeclaration
  | BlockStatement
  | ExpressionStatement
  | VariableDeclaration
  | AssignmentExpression
  | IfStatement
  | WhileStatement
  | ReturnStatement
  | BinaryExpression
  | CallExpression
  | Identifier
  | Literal
  | AllocExpression
  | FreeStatement
  | ArrayLiteral
  | IndexExpression
  | TryStatement;

export interface Position {
  line: number;
  column: number;
}

export interface BaseNode {
  type: string;
  pos: Position;
}

export interface Program extends BaseNode {
  type: 'Program';
  body: Statement[];
}

export type Statement =
  | FunctionDeclaration
  | BlockStatement
  | ExpressionStatement
  | VariableDeclaration
  | IfStatement
  | WhileStatement
  | ReturnStatement
  | FreeStatement
  | TryStatement
  | ClassDeclaration;

export type Expression =
  | AssignmentExpression
  | BinaryExpression
  | CallExpression
  | Identifier
  | Literal
  | AllocExpression
  | ArrayLiteral
  | IndexExpression
  | NewExpression
  | MemberExpression;

export interface FunctionDeclaration extends BaseNode {
  type: 'FunctionDeclaration';
  name: Identifier;
  params: Identifier[];
  body: BlockStatement;
}

export interface BlockStatement extends BaseNode {
  type: 'BlockStatement';
  body: Statement[];
}

export interface ExpressionStatement extends BaseNode {
  type: 'ExpressionStatement';
  expression: Expression;
}

export interface VariableDeclaration extends BaseNode {
  type: 'VariableDeclaration';
  name: Identifier;
  init: Expression; // for simplicity, must be initialized
}

export interface IfStatement extends BaseNode {
  type: 'IfStatement';
  condition: Expression;
  consequent: BlockStatement;
  alternate?: BlockStatement | IfStatement;
}

export interface WhileStatement extends BaseNode {
  type: 'WhileStatement';
  condition: Expression;
  body: BlockStatement;
}

export interface ReturnStatement extends BaseNode {
  type: 'ReturnStatement';
  argument: Expression | null;
}

export interface FreeStatement extends BaseNode {
  type: 'FreeStatement';
  pointer: Expression;
}

export interface AssignmentExpression extends BaseNode {
  type: 'AssignmentExpression';
  left: Identifier | IndexExpression | MemberExpression;
  right: Expression;
}

export type BinaryOperator = '+' | '-' | '*' | '/' | '==' | '!=' | '<' | '>' | '<=' | '>=';

export interface BinaryExpression extends BaseNode {
  type: 'BinaryExpression';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export interface CallExpression extends BaseNode {
  type: 'CallExpression';
  callee: Identifier;
  args: Expression[];
}

export interface Identifier extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface Literal extends BaseNode {
  type: 'Literal';
  value: number | string | boolean | null;
}

export interface AllocExpression extends BaseNode {
  type: 'AllocExpression';
  size: Expression;
}

export interface ArrayLiteral extends BaseNode {
  type: 'ArrayLiteral';
  elements: Expression[];
}

export interface IndexExpression extends BaseNode {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
}

export interface TryStatement extends BaseNode {
  type: 'TryStatement';
  block: BlockStatement;
  handler: BlockStatement;
}

export interface ClassDeclaration extends BaseNode {
  type: 'ClassDeclaration';
  name: Identifier;
  body: BlockStatement;
}

export interface NewExpression extends BaseNode {
  type: 'NewExpression';
  callee: Identifier;
  args: Expression[];
}

export interface MemberExpression extends BaseNode {
  type: 'MemberExpression';
  object: Expression;
  property: Identifier;
}
