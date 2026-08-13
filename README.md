<div align="center">
  <img src="src/assets/logo.png" width="128" alt="Halting Garden Logo" />
</div>

# Halting Garden

> It is a programming environment where your running code grows as a plant, and runtime bugs show up as visible disease.

Halting Garden is a small interpreter for a custom language called **Sprout**, paired with a generative botanical renderer. Instead of watching a debugger step through stack frames, you watch a plant grow: function calls become branches, loops become spinning whorls of leaves, heap allocations become roots, and - the actual point of the project - bugs become pathology you can _see_ rather than a red line of console text.

A memory leak isn't a warning banner. It's an amber, leaking root, and the sickness visibly climbs up into the exact branch that allocated it. A stack overflow isn't a stack trace. It's a stem that thins with every recursive call until it snaps. An infinite loop is a whorl of leaves spinning forever, never producing a new ring of growth.

---

## What it does

| Program behavior                 | Garden visualization                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Function call                    | New branch grows from the calling stem                                                            |
| Loop iteration                   | A "whorl" of leaves spins; each pass adds growth                                                  |
| `alloc(n)`                       | A root grows from the branch that made the call                                                   |
| `free(ptr)`                      | The corresponding root retracts cleanly                                                           |
| Unreleased allocation (leak)     | Root turns amber/red and rots; disease spreads up into the owning branch, fading toward the trunk |
| Unbounded recursion              | Stem desaturates and thins with depth, then snaps at the fault line                               |
| Infinite loop                    | Whorl spins in place, never completing a growth ring                                              |
| Runtime crash (e.g. double free) | The exact branch wilts and dies at the faulting line                                              |
| Array literal (`[1, 2, 3]`)      | A healthy green seedpod grows from the branch                                                     |
| Array Out-of-Bounds              | The seedpod suffers caterpillar rot (bitten/diseased) where the fault occurred                    |
| `try { ... } catch { ... }`      | Protective sap wraps the stem; a healed wound forms on crash, allowing growth to continue         |
| Class definition                 | Ethereal, glowing dashed-line blueprint rings appear                                              |
| Object instantiation             | Plump, amber-colored fruits grow from the branches                                                |
| Object properties                | Tiny seeds form inside the fruit                                                                  |
| Global Variable Abuse            | Invasive Kudzu vines aggressively wrap and choke the branches                                     |

Click any branch, leaf, or root in the garden and the corresponding source line highlights in the editor, with the live call stack and variable state for that point in execution shown in the inspector panel - debugging in both directions, code to plant and plant to code.

Eight presets ship with the app, covering every visual state: clean recursion (factorial, fibonacci), nested loops (bubble sort), a clean alloc/free lifecycle, and four deliberately broken programs - a memory leak, a stack overflow, an infinite loop, and a double-free crash.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     React UI Shell                       │
│    CodeMirror Editor  ·  Canvas Garden  ·  Inspector     │
└───────────────────────────┬──────────────────────────────┘
                            │ code + depth/iteration limits
                            ▼
┌──────────────────────────────────────────────────────────┐
│                 Web Worker Execution                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │        Sprout: lexer → parser → AST                │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           ▼                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │           Tree-walking interpreter                 │  │
│  │ tracks call depth, loop progress, heap reachability│  │
│  └────────────────────────┬───────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │ stream of typed ExecEvents
                            ▼
┌──────────────────────────────────────────────────────────┐
│           Pure reducer → GrowthNode tree                 │
│         Stateless Canvas 2D renderer (60fps)             │
│ • tapered organic stems, gradient bark/leaves/petals     │
│ • dynamic camera that zooms/pans to fit the plant        │
└──────────────────────────────────────────────────────────┘
```

The interpreter runs in a Web Worker so an infinite loop or runaway recursion in the _user's_ program never locks up the UI thread - the worker can be torn down independently of the render loop. Execution is decomposed into typed events (`call_enter`, `alloc`, `leak_detected`, etc.) consumed by a pure reducer that builds an immutable growth tree; the renderer never touches interpreter state directly, it only draws whatever tree the reducer currently holds. That separation is what makes click-to-code and the animated growth/disease effects possible without the renderer needing to know anything about language semantics.

Everything is static and client-side - no backend, no code sent over the network.

---

## Running it

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

```bash
npm run build    # type-check + production build
npm run test     # vitest
```

---

## Presets

1. **Factorial** - clean recursion, branches grow and fan out symmetrically.
2. **Fibonacci** - branching recursion, produces a denser tree from the double self-call.
3. **Bubble Sort** - nested loops, shows the whorl-within-whorl shape loops produce.
4. **Memory Lifecycle** - `alloc`/`free` in a loop; roots grow and cleanly retract.
5. **Sick: Memory Leak** - allocations in a loop that are never freed; roots rot amber and the sickness spreads up into the owning branch.
6. **Sick: Stack Overflow** - recursion with no base case; the stem thins with every call and snaps.
7. **Sick: Infinite Loop** - a loop that never terminates; the whorl spins without ever completing.
8. **Sick: Crash (bad allocation)** - freeing a pointer twice; the branch wilts and dies at the exact faulting line.
9. **Sick: Array Out of Bounds** - the seedpod suffers caterpillar rot when accessing past the end of the array.
10. **Try/Catch - Error Recovery** - an intentional crash is caught and sealed by protective sap, saving the plant.
11. **OOP - Blueprints & Fruits** - demonstrates class blueprints and object instantiation with properties.
12. **Sick: Global Variable Abuse** - invasive Kudzu vines crawl up the tree when a deep call stack mutates a global variable.

---

## Non-goals

Sprout is intentionally small - no imports or heavy standard libraries. It's built to make a handful of specific, teachable failure modes (leaks, unbounded recursion, infinite loops, invalid frees, global abuse, array bounds) visually legible, not to be a general-purpose language. There's no multi-language input except a simple Python transpiler and no persistence or accounts; every session starts from a preset or a blank editor.
