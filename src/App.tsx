import { useState, useEffect, useRef } from "react";
import { SplitPane } from "./components/SplitPane";
import { Editor } from "./components/Editor";
import { PlaybackControls } from "./components/PlaybackControls";
import { GardenRenderer } from "./components/GardenRenderer";
import { InspectorPanel } from "./components/InspectorPanel";
import { PRESETS } from "./presets";
import type { ExecEvent } from "./sprout/types";
import { gardenReducer, createInitialState } from "./garden/reducer";
import { Eraser } from "lucide-react";
import { transpilePythonToSprout } from "./sprout/transpiler";
import { CustomSelect } from "./components/CustomSelect";
import logo from "./assets/logo.png";

export default function App() {
  const [activePreset, setActivePreset] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [language, setLanguage] = useState<"sprout" | "python">("sprout");
  const [errorMsg, setErrorMsg] = useState("");
  const [eventsLength, setEventsLength] = useState(0);
  const eventsRef = useRef<ExecEvent[]>([]);

  const [highlightLine, setHighlightLine] = useState<number | undefined>();

  const [currentTick, setCurrentTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [gardenState, setGardenState] = useState(createInitialState());
  const [isWorkerDone, setIsWorkerDone] = useState(false);

  // Dynamic threshold settings
  const [maxDepth, setMaxDepth] = useState(50);
  const [maxIterations, setMaxIterations] = useState(200);

  // Web Worker reference
  const workerRef = useRef<Worker | null>(null);

  const runCode = (
    newCode: string,
    lang = language,
    depth = maxDepth,
    iters = maxIterations,
  ) => {
    // Terminate existing worker if active
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    eventsRef.current = [];
    setEventsLength(0);
    setErrorMsg("");
    setCurrentTick(0);
    setGardenState(createInitialState());
    setIsPlaying(true);
    setIsWorkerDone(false);
    setHighlightLine(undefined);
    prevTickRef.current = 0;

    // Spin up a new Web Worker using Vite URL worker import
    const worker = new Worker(new URL("./sprout/worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    const newEvents: ExecEvent[] = [];

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data.type === "event") {
        newEvents.push(data.event);
        eventsRef.current = [...newEvents];
        setEventsLength(newEvents.length);
      } else if (data.type === "done") {
        setIsWorkerDone(true);
      } else if (data.type === "error") {
        setErrorMsg(data.error);
        setIsWorkerDone(true);
      }
    };

    worker.onerror = () => {
      setErrorMsg("An error occurred inside the Web Worker.");
      setIsWorkerDone(true);
    };

    // Send code and execution limits to the Worker
    let codeToRun = newCode;
    if (lang === "python") {
      try {
        codeToRun = transpilePythonToSprout(newCode);
      } catch (err: any) {
        setErrorMsg("Transpilation error: " + err.message);
        setIsWorkerDone(true);
        return;
      }
    }

    worker.postMessage({
      code: codeToRun,
      maxDepth: depth,
      maxIterations: iters,
    });
  };

  useEffect(() => {
    runCode(code, language, maxDepth, maxIterations);
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(
      () => {
        setCurrentTick((t) => {
          if (t < eventsRef.current.length) {
            return t + 1;
          }
          if (isWorkerDone) {
            setIsPlaying(false);
          }
          return t;
        });
      },
      1000 / (10 * speed),
    );

    return () => clearInterval(interval);
  }, [isPlaying, speed, isWorkerDone]);

  const prevTickRef = useRef(0);

  // Reconstruct garden state to keep up with current playback ticks
  useEffect(() => {
    setGardenState((prevState) => {
      if (currentTick === 0) {
        prevTickRef.current = 0;
        return createInitialState();
      } else if (currentTick > prevTickRef.current) {
        let newState = prevState;
        for (let i = prevTickRef.current; i < currentTick; i++) {
          if (eventsRef.current[i]) {
            newState = gardenReducer(newState, eventsRef.current[i]);
          }
        }
        prevTickRef.current = currentTick;
        return newState;
      } else {
        // currentTick < prevTickRef.current
        let newState = createInitialState();
        for (let i = 0; i < currentTick; i++) {
          if (eventsRef.current[i]) {
            newState = gardenReducer(newState, eventsRef.current[i]);
          }
        }
        prevTickRef.current = currentTick;
        return newState;
      }
    });
  }, [currentTick]);

  const handlePresetChange = (id: string) => {
    if (id === "") {
      setActivePreset("");
      setCode("");
      runCode("", language, maxDepth, maxIterations);
      return;
    }
    const preset = PRESETS.find((p) => p.id === id);
    if (preset) {
      setActivePreset(id);
      setCode(preset.code);
      setLanguage("sprout");
      runCode(preset.code, "sprout", maxDepth, maxIterations);
    }
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const handleReset = () => {
    runCode(code, language, maxDepth, maxIterations);
  };

  const handleClear = () => {
    setActivePreset("");
    setCode("");
    runCode("", language, maxDepth, maxIterations);
  };

  // F8: turn a raw pathology event into a plain-language, specific
  // explanation - "3 allocations at line 7 were never freed," not just
  // the interpreter's internal error string. This is what makes the
  // diagnosis panel a genuine debugging aid instead of a status light.
  const leakedRoots = collectLeakedRoots(gardenState.tree);
  const diagnosis = describePathology(gardenState.error, leakedRoots);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-main)",
        color: "var(--text-primary)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logo} alt="Halting Garden Logo" style={{ width: "36px", height: "36px", objectFit: "contain" }} />
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: "var(--text-primary)",
              }}
            >
              Halting Garden
            </h1>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              Visualizing program execution as organic growth
            </p>
          </div>
        </div>

        {/* Playback Configuration Panel */}
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          {/* Recursion Depth Limit Slider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "var(--text-secondary)",
            }}
          >
            <span title="Max Call Stack Recursion Depth">Depth Limit:</span>
            <input
              type="range"
              min="10"
              max="300"
              value={maxDepth}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxDepth(val);
                runCode(code, language, val, maxIterations);
              }}
              style={{
                width: "80px",
                accentColor: "var(--accent-emerald)",
                cursor: "pointer",
              }}
            />
            <span
              style={{
                minWidth: "24px",
                fontFamily: "monospace",
                color: "var(--text-primary)",
              }}
            >
              {maxDepth}
            </span>
          </div>

          {/* Loop Iterations Limit Slider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "var(--text-secondary)",
            }}
          >
            <span title="Max Loop Iterations Limit">Loop Limit:</span>
            <input
              type="range"
              min="50"
              max="2000"
              value={maxIterations}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxIterations(val);
                runCode(code, language, maxDepth, val);
              }}
              style={{
                width: "80px",
                accentColor: "var(--accent-emerald)",
                cursor: "pointer",
              }}
            />
            <span
              style={{
                minWidth: "32px",
                fontFamily: "monospace",
                color: "var(--text-primary)",
              }}
            >
              {maxIterations}
            </span>
          </div>

          {/* Language Selector */}
          <CustomSelect
            value={language}
            onChange={(val) => {
              const newLang = val as "sprout" | "python";
              setLanguage(newLang);
              runCode(code, newLang, maxDepth, maxIterations);
            }}
            options={[
              { label: "Sprout", value: "sprout" },
              { label: "Python", value: "python" },
            ]}
          />

          {/* Preset Selector */}
          <CustomSelect
            value={activePreset}
            onChange={(val) => handlePresetChange(String(val))}
            options={[
              { label: "Presets...", value: "", disabled: activePreset === "" },
              ...PRESETS.map((p) => ({ label: p.name, value: p.id })),
            ]}
            placeholder="Presets..."
          />

          {/* Clear Button */}
          <button
            onClick={handleClear}
            title="Clear Workspace"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
              padding: "10px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Eraser size={18} />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          padding: "0 var(--gutter) var(--gutter) var(--gutter)",
        }}
      >
        <SplitPane
          left={
            <>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <Editor
                  code={code}
                  onChange={handleCodeChange}
                  highlightLine={highlightLine}
                />
              </div>
              <PlaybackControls
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onStep={() =>
                  setCurrentTick((t) =>
                    Math.min(t + 1, eventsRef.current.length),
                  )
                }
                onReset={handleReset}
                speed={speed}
                onSpeedChange={setSpeed}
              />
            </>
          }
          right={
            <SplitPane
              hideBorders={true}
              initialLeftWidth={600}
              left={
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    background: "var(--bg-panel)",
                  }}
                >
                  <GardenRenderer
                    state={gardenState}
                    onClickNode={(node) => {
                      if (node.sourceLine) {
                        setHighlightLine(node.sourceLine);
                      }
                    }}
                  />

                  {/* Visual Error Overlay */}
                  {errorMsg && (
                    <div
                      style={{
                        position: "absolute",
                        top: "16px",
                        left: "16px",
                        right: "16px",
                        background: "var(--accent-rose)",
                        color: "white",
                        padding: "16px",
                        borderRadius: "8px",
                        zIndex: 10,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      }}
                    >
                      <strong>Execution Error:</strong> {errorMsg}
                    </div>
                  )}

                  {/* Diagnosis Panel (F8) - plain-language, causal explanation
                      of whichever pathology is active, not just the raw
                      interpreter message. */}
                  {diagnosis && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "16px",
                        left: "16px",
                        right: "16px",
                        background: "var(--bg-surface)",
                        padding: "16px",
                        borderRadius: "8px",
                        border: `1px solid ${diagnosis.accent}`,
                        zIndex: 10,
                      }}
                    >
                      <h3
                        style={{
                          margin: "0 0 8px 0",
                          color: diagnosis.accent,
                          fontSize: "14px",
                        }}
                      >
                        {diagnosis.title}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "var(--text-primary)",
                          lineHeight: 1.5,
                        }}
                      >
                        {diagnosis.message}
                      </p>
                    </div>
                  )}

                  {/* Event debug overlay */}
                  <div
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: "16px",
                      background: "rgba(11, 13, 16, 0.8)",
                      backdropFilter: "blur(4px)",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      pointerEvents: "none",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        marginBottom: "4px",
                      }}
                    >
                      <span>Tick</span>
                      <span
                        style={{
                          color: "var(--text-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {currentTick} /{" "}
                        {eventsLength || eventsRef.current.length}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        marginBottom: "4px",
                      }}
                    >
                      <span>Active Nodes</span>
                      <span
                        style={{
                          color: "var(--text-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {gardenState.activePath.length}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                      }}
                    >
                      <span>Status</span>
                      <span
                        style={{
                          color: isPlaying
                            ? "var(--accent-emerald)"
                            : "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {isPlaying ? "Playing" : "Paused"}
                      </span>
                    </div>
                  </div>
                </div>
              }
              right={
                <InspectorPanel
                  events={eventsRef.current}
                  currentTick={currentTick}
                />
              }
            />
          }
        />
      </div>
    </div>
  );
}

// --- F8 diagnosis helpers ---

interface LeakedRoot {
  id: string;
  sourceLine?: number;
}

function collectLeakedRoots(
  node: import("./garden/types").GrowthNode | null,
): LeakedRoot[] {
  if (!node) return [];
  const found: LeakedRoot[] = [];
  const visit = (n: import("./garden/types").GrowthNode) => {
    for (const root of n.roots) {
      if (root.health < 1)
        found.push({ id: root.id, sourceLine: root.sourceLine });
    }
    for (const child of n.children) visit(child);
  };
  visit(node);
  return found;
}

interface Diagnosis {
  title: string;
  message: string;
  accent: string;
}

function describePathology(
  error: { kind: string; message: string; nodeId: string } | null,
  leakedRoots: LeakedRoot[],
): Diagnosis | null {
  if (error) {
    switch (error.kind) {
      case "InfiniteLoop":
        return {
          title: "Infinite Loop",
          message:
            "This loop ran 200+ times without its condition ever becoming false - it will never exit on its own. Look for a variable inside the loop that should be changing but isn’t.",
          accent: "var(--accent-amber)",
        };
      case "StackOverflow":
        return {
          title: "Stack Overflow",
          message:
            "A function kept calling itself past the recursion depth limit without ever returning - almost always a missing or unreachable base case. Look for the condition that’s supposed to stop the recursion.",
          accent: "var(--accent-amber)",
        };
      default:
        return {
          title: "Runtime Error",
          message: error.message,
          accent: "var(--accent-amber)",
        };
    }
  }

  if (leakedRoots.length > 0) {
    const lines = Array.from(
      new Set(
        leakedRoots
          .map((r) => r.sourceLine)
          .filter((l): l is number => l !== undefined),
      ),
    );
    const where =
      lines.length === 1
        ? `at line ${lines[0]}`
        : lines.length > 1
          ? `across lines ${lines.join(", ")}`
          : "";
    const count = leakedRoots.length;
    return {
      title: "Memory Leak",
      message: `${count} allocation${count === 1 ? " was" : "s were"} never freed${where ? " " + where : ""} - the roots holding them are discolouring and the disease is spreading up into the branch that made them. Add a matching free() for each alloc().`,
      accent: "var(--accent-rose)",
    };
  }

  return null;
}
