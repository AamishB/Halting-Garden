import { Parser } from './parser';
import { Interpreter } from './interpreter';
import type { ExecEvent } from './types';

console.log("Worker script loaded");

self.onmessage = (e: MessageEvent) => {
  console.log("Worker received message:", e.data);
  const { code, maxDepth, maxIterations } = e.data;

  let tickCount = 0;
  const MAX_TICKS = 50000;

  const onEvent = (event: ExecEvent) => {
    tickCount++;
    if (tickCount > MAX_TICKS) {
      throw new Error(`Execution exceeded maximum allowed ticks (${MAX_TICKS}). Program halted.`);
    }
    self.postMessage({ type: 'event', event });
  };

  try {
    console.log("Parsing...");
    const parser = new Parser(code);
    const ast = parser.parse();
    
    console.log("Interpreting...");
    const interpreter = new Interpreter(onEvent, { maxDepth, maxIterations });
    interpreter.interpret(ast);
    console.log("Done interpreting");
    
    self.postMessage({ type: 'done' });
  } catch (error: any) {
    console.error("Worker caught error:", error);
    self.postMessage({ 
      type: 'error', 
      error: error.message || 'Execution error' 
    });
  }
};
