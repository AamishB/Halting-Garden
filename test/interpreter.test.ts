import { describe, it, expect } from 'vitest';
import { Parser } from '../src/sprout/parser';
import { Interpreter } from '../src/sprout/interpreter';
import { transpileToSprout } from '../src/sprout/transpiler';

describe('Interpreter', () => {
  it('should run a basic factorial program', () => {
    const code = `
    fn factorial(n) {
      if (n < 2) {
        return 1;
      } else {
        return n * factorial(n - 1);
      }
    }
    
    var res = factorial(3);
    var ptr = alloc(10);
    free(ptr);
    `;
    const parser = new Parser(code);
    const ast = parser.parse();
    
    const events: any[] = [];
    const interpreter = new Interpreter((event) => {
      events.push(event);
    });
    
    interpreter.interpret(ast);
    
    expect(events.length).toBeGreaterThan(0);
    // basic sanity checks
    expect(events.some(e => e.type === 'program_start')).toBe(true);
    expect(events.some(e => e.type === 'alloc')).toBe(true);
    expect(events.some(e => e.type === 'free')).toBe(true);
    expect(events.some(e => e.type === 'program_end' && e.status === 'ok')).toBe(true);
  });
});

describe('Transpiler', () => {
  it('should transpile basic JavaScript', () => {
    const jsCode = `
      function test() {
        let x = 10;
        const y = 20;
      }
    `;
    const sprout = transpileToSprout(jsCode, 'javascript');
    expect(sprout).toContain('fn test()');
    expect(sprout).toContain('var x = 10');
    expect(sprout).toContain('var y = 20');
  });

  it('should transpile multiline JavaScript objects', () => {
    const jsCode = `
      function config() {
        let obj = {
          a: 1,
          b: 2
        };
      }
    `;
    const sprout = transpileToSprout(jsCode, 'javascript');
    expect(sprout).toContain('fn config()');
    expect(sprout).toContain('var obj = {');
  });

  it('should transpile multiline Python dicts', () => {
    const pyCode = `
def config():
    obj = {
        'a': 1,
        'b': 2
    }
    return obj
`;
    const sprout = transpileToSprout(pyCode, 'python');
    expect(sprout).toContain('fn config() {');
    expect(sprout).toContain('var obj = {');
  });
});
