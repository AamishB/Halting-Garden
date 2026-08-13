import * as AST from "./ast";
import type { ExecEvent, Value } from "./types";

// Exception for returning values from functions
class ReturnException {
  public value: Value;
  public sourceLine: number;
  constructor(value: Value, sourceLine: number) {
    this.value = value;
    this.sourceLine = sourceLine;
  }
}

// Thrown after a pathology 'error' event has already been emitted at the
// true fault site, so the outer catch in interpret() must not emit a
// second, generic error that would overwrite the correct one.
class HaltedException {
  public reason: string;
  constructor(reason: string) {
    this.reason = reason;
  }
}

export class Environment {
  private values = new Map<string, Value>();
  public readonly id = Math.random().toString(36).substring(2, 9);
  public enclosing: Environment | null;

  constructor(enclosing: Environment | null = null) {
    this.enclosing = enclosing;
  }

  public define(name: string, value: Value) {
    this.values.set(name, value);
  }

  public get(name: string): Value {
    if (this.values.has(name)) {
      return this.values.get(name)!;
    }
    if (this.enclosing !== null) {
      return this.enclosing.get(name);
    }
    throw new Error(`Undefined variable '${name}'.`);
  }

  public assign(name: string, value: Value) {
    if (this.values.has(name)) {
      this.values.set(name, value);
      return;
    }
    if (this.enclosing !== null) {
      this.enclosing.assign(name, value);
      return;
    }
    throw new Error(`Undefined variable '${name}'.`);
  }

  public getLocals(): string[] {
    return Array.from(this.values.keys());
  }

  public containsValue(target: Value): boolean {
    for (const val of this.values.values()) {
      if (val === target) return true;
    }
    if (this.enclosing !== null) {
      return this.enclosing.containsValue(target);
    }
    return false;
  }
}

export class Interpreter {
  private global = new Environment();
  private env = this.global;
  private tick = 0;
  private assignmentCount = 0;

  // Call stack tracking
  private callStack: { nodeId: string; fnName: string; env: Environment }[] =
    [];

  // Node ID tracking for nested structures
  private currentNodeId = "root";

  // Last-known location, for attributing genuinely unexpected runtime
  // errors (undefined variable, bad free, etc.) to the right place.
  private lastKnownNodeId = "root";
  private lastKnownLine = 1;

  // Memory management
  private nextPtr = 1;
  private heap = new Map<
    string,
    { size: number; sourceLine: number; allocTick: number }
  >(); // ptrId -> info

  // Function & Class registry
  private functions = new Map<string, AST.FunctionDeclaration>();
  private classes = new Map<string, AST.ClassDeclaration>();
  private onEvent: (event: ExecEvent) => void;
  private maxDepth = 50;
  private maxIterations = 200;

  constructor(
    onEvent: (event: ExecEvent) => void,
    options?: { maxDepth?: number; maxIterations?: number },
  ) {
    this.onEvent = onEvent;
    if (options) {
      if (options.maxDepth !== undefined) this.maxDepth = options.maxDepth;
      if (options.maxIterations !== undefined)
        this.maxIterations = options.maxIterations;
    }
  }

  // Pointers already reported as leaked, so we don't re-emit every check.
  private reportedLeaks = new Set<string>();

  private emit(event: any) {
    this.onEvent({ ...event, tick: this.tick++ } as ExecEvent);
    if (this.tick % 20 === 0) {
      this.checkMemoryLeaks();
    }
  }

  // A pointer only counts as a leak once it has fallen out of scope
  // (unreachable from any live environment) while still un-freed - not
  // merely "not freed yet," which would flag every allocation still
  // legitimately in use. This mirrors how a real leak detector works:
  // it's a leak once nothing can reach it anymore, not before.
  private checkMemoryLeaks() {
    for (const [ptr, info] of this.heap.entries()) {
      if (this.reportedLeaks.has(ptr)) continue;
      if (!this.isReachable(ptr)) {
        this.reportedLeaks.add(ptr);
        this.emit({
          type: "leak_detected",
          ptrId: ptr,
          allocLine: info.sourceLine,
          ageInTicks: this.tick - info.allocTick,
        });
      }
    }
  }

  private isReachable(ptr: string): boolean {
    if (this.global.containsValue(ptr)) return true;
    for (const frame of this.callStack) {
      if (frame.env.containsValue(ptr)) return true;
    }
    if (this.env.containsValue(ptr)) return true;
    return false;
  }

  private generateId() {
    return Math.random().toString(36).substring(2, 9);
  }

  public interpret(program: AST.Program) {
    this.emit({ type: "program_start" });
    try {
      for (const statement of program.body) {
        if (statement.type === "FunctionDeclaration") {
          this.functions.set(statement.name.name, statement);
        } else if (statement.type === "ClassDeclaration") {
          this.classes.set(statement.name.name, statement);
          this.emit({
            type: "class_declare",
            nodeId: this.currentNodeId,
            className: statement.name.name,
            sourceLine: statement.pos.line,
          });
        } else {
          this.execute(statement);
        }
      }
      // Check for memory leaks one last time
      this.checkMemoryLeaks();

      this.emit({ type: "program_end", status: "ok" });
    } catch (error: any) {
      if (error instanceof HaltedException) {
        // The precise 'error' event was already emitted at the fault site
        // (see WhileStatement / call depth checks below). Don't re-emit.
        this.emit({ type: "program_end", status: "error" });
        return;
      }
      this.emit({
        type: "error",
        kind: "RuntimeError",
        message: error.message || "Unknown error",
        nodeId: this.lastKnownNodeId,
        sourceLine: this.lastKnownLine,
      });
      this.emit({ type: "program_end", status: "error" });
    }
  }

  private execute(stmt: AST.Statement) {
    this.lastKnownNodeId = this.currentNodeId;
    this.lastKnownLine = stmt.pos.line;
    switch (stmt.type) {
      case "ExpressionStatement":
        this.evaluate(stmt.expression);
        break;
      case "VariableDeclaration": {
        const value = this.evaluate(stmt.init);
        this.env.define(stmt.name.name, value);
        this.assignmentCount++;
        this.emit({
          type: "var_declare",
          nodeId: this.currentNodeId,
          scopeId: this.env.id,
          name: stmt.name.name,
          value,
          sourceLine: stmt.pos.line,
        });
        break;
      }
      case "BlockStatement":
        this.executeBlock(stmt.body, new Environment(this.env));
        break;
      case "IfStatement":
        if (this.isTruthy(this.evaluate(stmt.condition))) {
          this.execute(stmt.consequent);
        } else if (stmt.alternate) {
          this.execute(stmt.alternate);
        }
        break;
      case "WhileStatement": {
        const loopNodeId = this.generateId();
        const parentId = this.currentNodeId;
        this.currentNodeId = loopNodeId;

        this.emit({
          type: "loop_enter",
          nodeId: loopNodeId,
          parentId,
          sourceLine: stmt.pos.line,
        });

        let iteration = 0;
        let iterationsWithoutStateChange = 0;
        while (this.isTruthy(this.evaluate(stmt.condition))) {
          if (iteration > this.maxIterations) {
            this.emit({
              type: "error",
              kind: "InfiniteLoop",
              message: `Runaway loop detected: this loop ran ${this.maxIterations}+ times without exiting.`,
              nodeId: loopNodeId,
              sourceLine: stmt.pos.line,
            });
            throw new HaltedException("InfiniteLoop");
          }

          const assignsBefore = this.assignmentCount;

          this.emit({
            type: "loop_iter",
            nodeId: loopNodeId,
            iteration,
          });
          this.execute(stmt.body);

          if (this.assignmentCount === assignsBefore) {
            iterationsWithoutStateChange++;
            if (iterationsWithoutStateChange > 20) {
              this.emit({
                type: "no_progress_warning",
                nodeId: loopNodeId,
                iterationsWithoutStateChange,
              });
            }
          } else {
            iterationsWithoutStateChange = 0;
          }

          iteration++;
        }

        this.emit({
          type: "loop_exit",
          nodeId: loopNodeId,
          totalIterations: iteration,
        });

        this.currentNodeId = parentId;
        break;
      }
      case "ReturnStatement": {
        let value: Value = null;
        if (stmt.argument) {
          value = this.evaluate(stmt.argument);
        }
        throw new ReturnException(value, stmt.pos.line);
      }
      case "FreeStatement": {
        const ptr = this.evaluate(stmt.pointer);
        if (typeof ptr !== "string" || !ptr.startsWith("ptr_")) {
          throw new Error("Invalid pointer for free.");
        }
        if (!this.heap.has(ptr)) {
          throw new Error(`Double free or invalid pointer: ${ptr}`);
        }
        this.heap.delete(ptr);
        this.emit({
          type: "free",
          ptrId: ptr,
          sourceLine: stmt.pos.line,
        });
        break;
      }
      case "TryStatement": {
        this.emit({
          type: "try_enter",
          nodeId: this.currentNodeId,
          sourceLine: stmt.pos.line,
        });
        try {
          this.executeBlock(stmt.block.body, new Environment(this.env));
        } catch (error: any) {
          if (error instanceof ReturnException) {
            throw error; // Let returns bubble up
          }
          const msg =
            error.message ||
            (error instanceof HaltedException ? error.reason : "Unknown error");
          this.emit({
            type: "error_caught",
            nodeId: this.currentNodeId,
            kind: "CaughtException",
            message: msg,
            sourceLine: stmt.pos.line,
          });
          this.emit({
            type: "except_enter",
            nodeId: this.currentNodeId,
            sourceLine: stmt.pos.line,
          });
          this.executeBlock(stmt.handler.body, new Environment(this.env));
        }
        break;
      }
    }
  }

  private executeBlock(statements: AST.Statement[], env: Environment) {
    const previous = this.env;
    try {
      this.env = env;
      for (const statement of statements) {
        this.execute(statement);
      }
    } finally {
      const droppedVars = this.env.getLocals();
      if (droppedVars.length > 0) {
        this.emit({
          type: "scope_exit",
          scopeId: this.env.id,
          droppedVars,
        });
      }
      this.env = previous;
    }
  }

  private evaluate(expr: AST.Expression): Value {
    switch (expr.type) {
      case "Literal":
        return expr.value;
      case "Identifier":
        return this.env.get(expr.name);
      case "AssignmentExpression": {
        if (expr.left.type === "Identifier") {
          let current: Environment | null = this.env;
          while (current !== null) {
            if (current.getLocals().includes(expr.left.name)) break;
            current = current.enclosing;
          }
          if (current === this.global && this.callStack.length >= 2) {
            this.emit({
              type: "global_abuse",
              nodeId: this.currentNodeId,
              varName: expr.left.name,
              depth: this.callStack.length,
              sourceLine: expr.pos.line,
            });
          }

          const oldValue = this.env.get(expr.left.name);
          const newValue = this.evaluate(expr.right);
          this.env.assign(expr.left.name, newValue);
          this.assignmentCount++;
          this.emit({
            type: "var_assign",
            nodeId: this.currentNodeId,
            name: expr.left.name,
            oldValue,
            newValue,
            sourceLine: expr.pos.line,
          });
          return newValue;
        } else if (expr.left.type === "IndexExpression") {
          const object = this.evaluate(expr.left.object);
          const index = this.evaluate(expr.left.index);
          const newValue = this.evaluate(expr.right);

          if (!Array.isArray(object))
            throw new Error("Attempted to index a non-array.");
          if (typeof index !== "number" || !Number.isInteger(index))
            throw new Error("Array index must be an integer.");
          if (index < 0 || index >= object.length) {
            this.emit({
              type: "array_oob",
              nodeId: this.currentNodeId,
              name: "array",
              index,
              length: object.length,
              sourceLine: expr.pos.line,
            });
            throw new Error(
              `Index ${index} out of bounds for array of length ${object.length}`,
            );
          }

          const oldValue = object[index];
          object[index] = newValue;
          this.assignmentCount++;
          this.emit({
            type: "var_assign",
            nodeId: this.currentNodeId,
            name: "array_element",
            oldValue,
            newValue,
            sourceLine: expr.pos.line,
          });
          return newValue;
        } else if (expr.left.type === "MemberExpression") {
          const object = this.evaluate(expr.left.object);
          if (
            typeof object !== "object" ||
            object === null ||
            !("props" in object)
          ) {
            throw new Error("Attempted to assign property on non-object.");
          }
          const newValue = this.evaluate(expr.right);
          object.props[expr.left.property.name] = newValue;
          this.assignmentCount++;

          this.emit({
            type: "prop_assign",
            nodeId: this.currentNodeId,
            objId: object.id,
            propName: expr.left.property.name,
            value: newValue,
            sourceLine: expr.pos.line,
          });
          return newValue;
        }
        break;
      }
      case "BinaryExpression": {
        const left = this.evaluate(expr.left);
        const right = this.evaluate(expr.right);
        switch (expr.operator) {
          case "+":
            return (left as any) + (right as any);
          case "-":
            return (left as number) - (right as number);
          case "*":
            return (left as number) * (right as number);
          case "/":
            return (left as number) / (right as number);
          case "==":
            return left === right;
          case "!=":
            return left !== right;
          case "<":
            return (left as number) < (right as number);
          case "<=":
            return (left as number) <= (right as number);
          case ">":
            return (left as number) > (right as number);
          case ">=":
            return (left as number) >= (right as number);
        }
        break;
      }
      case "CallExpression": {
        if (expr.callee.name === "print") {
          const args = expr.args.map((a) => this.evaluate(a));
          console.log(...args);
          return null;
        }

        const fn = this.functions.get(expr.callee.name);
        if (!fn) {
          throw new Error(`Undefined function '${expr.callee.name}'.`);
        }

        const args = expr.args.map((a) => this.evaluate(a));
        if (args.length !== fn.params.length) {
          throw new Error(
            `Expected ${fn.params.length} arguments but got ${args.length}.`,
          );
        }

        const callNodeId = this.generateId();
        const parentId = this.currentNodeId;
        this.currentNodeId = callNodeId;

        const callEnv = new Environment(this.global);
        for (let i = 0; i < fn.params.length; i++) {
          callEnv.define(fn.params[i].name, args[i]);
        }

        this.callStack.push({
          nodeId: callNodeId,
          fnName: fn.name.name,
          env: callEnv,
        });
        const depth = this.callStack.length;

        const warningThreshold = Math.max(5, Math.round(this.maxDepth * 0.2));
        if (depth > this.maxDepth) {
          this.emit({
            type: "error",
            kind: "StackOverflow",
            message: `Maximum recursion depth exceeded in '${fn.name.name}' (${this.maxDepth}) - likely missing a base case.`,
            nodeId: callNodeId,
            sourceLine: expr.pos.line,
          });
          this.callStack.pop();
          this.currentNodeId = parentId;
          throw new HaltedException("StackOverflow");
        } else if (depth > warningThreshold) {
          this.emit({
            type: "depth_warning",
            depth,
            threshold: warningThreshold,
          });
        }

        this.emit({
          type: "call_enter",
          nodeId: callNodeId,
          parentId,
          fnName: fn.name.name,
          args,
          depth,
          sourceLine: expr.pos.line,
        });

        let returnValue: Value = null;
        let returnLine = expr.pos.line;

        try {
          this.executeBlock(fn.body.body, callEnv);
        } catch (e) {
          if (e instanceof ReturnException) {
            returnValue = e.value;
            returnLine = e.sourceLine;
          } else {
            throw e;
          }
        } finally {
          this.callStack.pop();
          this.currentNodeId = parentId;
        }

        this.emit({
          type: "call_exit",
          nodeId: callNodeId,
          returnValue,
          sourceLine: returnLine,
        });

        return returnValue;
      }
      case "AllocExpression": {
        const size = this.evaluate(expr.size);
        if (typeof size !== "number") {
          throw new Error("alloc size must be a number");
        }
        const ptr = `ptr_${this.nextPtr++}`;
        this.heap.set(ptr, {
          size,
          sourceLine: expr.pos.line,
          allocTick: this.tick,
        });
        this.emit({
          type: "alloc",
          nodeId: this.currentNodeId,
          ptrId: ptr,
          size,
          sourceLine: expr.pos.line,
        });
        return ptr;
      }
      case "ArrayLiteral": {
        const elements = expr.elements.map((e) => this.evaluate(e));
        this.emit({
          type: "array_declare",
          nodeId: this.currentNodeId,
          scopeId: this.env.id,
          name: "anonymous",
          elements: [...elements],
          sourceLine: expr.pos.line,
        });
        return elements;
      }
      case "IndexExpression": {
        const object = this.evaluate(expr.object);
        const index = this.evaluate(expr.index);
        if (!Array.isArray(object)) {
          throw new Error("Attempted to index a non-array.");
        }
        if (typeof index !== "number" || !Number.isInteger(index)) {
          throw new Error("Array index must be an integer.");
        }
        if (index < 0 || index >= object.length) {
          this.emit({
            type: "array_oob",
            nodeId: this.currentNodeId,
            name: "array",
            index,
            length: object.length,
            sourceLine: expr.pos.line,
          });
          throw new Error(
            `Index ${index} out of bounds for array of length ${object.length}`,
          );
        }
        this.emit({
          type: "array_access",
          nodeId: this.currentNodeId,
          name: "array",
          index,
          value: object[index],
          sourceLine: expr.pos.line,
        });
        return object[index];
      }
      case "NewExpression": {
        const cls = this.classes.get(expr.callee.name);
        if (!cls) throw new Error(`Undefined class '${expr.callee.name}'.`);

        const objId = `obj_${this.nextPtr++}`;
        const obj: any = { id: objId, className: cls.name.name, props: {} };

        this.emit({
          type: "object_instantiate",
          nodeId: this.currentNodeId,
          className: cls.name.name,
          objId,
          sourceLine: expr.pos.line,
        });

        const initEnv = new Environment(this.global);
        initEnv.define("this", obj);

        try {
          this.executeBlock(cls.body.body, initEnv);
        } catch (e) {
          if (e instanceof ReturnException) {
            /* ignore returns in constructor */
          } else throw e;
        }

        return obj;
      }
      case "MemberExpression": {
        const object = this.evaluate(expr.object);
        if (
          typeof object !== "object" ||
          object === null ||
          !("props" in object)
        ) {
          throw new Error("Attempted to access property on non-object.");
        }
        return object.props[expr.property.name];
      }
    }
    return null;
  }

  private isTruthy(value: Value): boolean {
    if (value === null || value === false || value === 0 || value === "")
      return false;
    return true;
  }
}
