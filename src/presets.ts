export interface Preset {
  id: string;
  name: string;
  code: string;
}

// Six presets, one per visual state, per the PRD (F5). Sprout-only - the
// project's pitch is specifically "a small custom language," and mixing in
// other languages diluted that story without adding real capability.
export const PRESETS: Preset[] = [
  {
    id: "factorial",
    name: "Factorial - clean recursion",
    code: `fn factorial(n) {
  if (n < 2) {
    return 1;
  } else {
    return n * factorial(n - 1);
  }
}

var result = factorial(5);
`,
  },
  {
    id: "fibonacci",
    name: "Fibonacci - branching recursion",
    code: `fn fib(n) {
  if (n < 2) {
    return n;
  } else {
    return fib(n-1) + fib(n-2);
  }
}

var f = fib(6);
`,
  },
  {
    id: "bubble_sort",
    name: "Bubble Sort - nested loops",
    code: `var n = 4;
var i = 0;
while (i < n) {
  var j = 0;
  while (j < n - 1) {
    // A real sort would compare and swap array elements here.
    // What matters for the garden is the whorl-within-whorl shape
    // that nested loops always produce, regardless of what's inside.
    j = j + 1;
  }
  i = i + 1;
}
`,
  },
  {
    id: "alloc_free",
    name: "Memory Lifecycle - clean roots",
    code: `var i = 3;
while(i > 0) {
  var ptr = alloc(5);
  // Do some work...
  var k = 2;
  while(k > 0) { k = k - 1; }

  free(ptr);
  i = i - 1;
}
`,
  },
  {
    id: "memory_leak",
    name: "Sick: Memory Leak",
    code: `var i = 5;
while(i > 0) {
  // We allocate memory, but never call free(ptr)
  // Roots will turn amber as they leak
  var ptr = alloc(10);
  i = i - 1;
}
`,
  },
  {
    id: "stack_overflow",
    name: "Sick: Stack Overflow (no base case)",
    code: `fn recurse(n) {
  // No base case!
  // Watch the branch get thinner and then snap (die)
  return recurse(n + 1);
}

recurse(1);
`,
  },
  {
    id: "infinite_loop",
    name: "Sick: Infinite Loop",
    code: `var i = 1;
// Forgot to decrement i!
// Watch the whorl spin without making progress
while(i > 0) {
  var k = 1;
}
`,
  },
  {
    id: "off_by_one",
    name: "Sick: Crash (bad allocation)",
    code: `fn readSlot(ptr, offset) {
  // No bounds checking in Sprout - freeing a pointer twice, or
  // freeing one that was never allocated, is a hard crash.
  // Watch the branch snap and wilt at the exact faulting line.
  free(ptr);
  return offset;
}

var buffer = alloc(8);
free(buffer);
var result = readSlot(buffer, 9);
`,
  },
  {
    id: "array_oob",
    name: "Sick: Array Out of Bounds",
    code: `var arr = [1, 2, 3];
var i = 0;
while (i < 4) {
  // Watch the pod get destroyed (caterpillar rot) as we access an out-of-bounds index on the final iteration!
  var x = arr[i];
  i = i + 1;
}
`,
  },
  {
    id: "try_except",
    name: "Try/Catch - Error Recovery",
    code: `var arr = [1, 2, 3];
try {
  // We'll intentionally access out of bounds to trigger an error
  var x = arr[5];
} catch {
  // The error snaps the branch, but the protective sap seals it instantly
  // so growth continues unharmed from the catch block!
  var recovered = true;
}
`,
  },
  {
    id: "oop_basic",
    name: "OOP - Blueprints & Fruits",
    code: `class Seedling {
  this.height = 10;
  this.alive = true;
}

var myPlant = new Seedling();
myPlant.height = 20;
`,
  },
  {
    id: "global_abuse",
    name: "Sick: Global Variable Abuse",
    code: `var globalState = 0;

fn deepCall() {
  return deeperCall();
}

fn deeperCall() {
  // Deep in the call stack, we mutate a global variable!
  // Watch the invasive Kudzu vines crawl up the tree branches.
  globalState = 1;
  return globalState;
}

deepCall();
`,
  },
];
