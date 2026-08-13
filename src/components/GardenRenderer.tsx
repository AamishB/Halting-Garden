import React, { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import type { GardenState, GrowthNode, Root } from "../garden/types";
import { GardenRenderer2D } from "../garden/renderer2d";

interface GardenRendererProps {
  state: GardenState;
  onClickNode?: (node: GrowthNode | Root) => void;
}

export const GardenRenderer: React.FC<GardenRendererProps> = ({
  state,
  onClickNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GardenRenderer2D | null>(null);

  // The canvas's *drawing* resolution (CSS px, pre-DPR scaling) - this is
  // what the renderer lays the plant out against. It used to be a fixed
  // 600x800 default regardless of how big the panel actually was, so on a
  // real window the plant was drawn small and then either letterboxed or
  // stretched by CSS instead of actually filling the space.
  const [size, setSize] = useState({ width: 600, height: 800 });

  const [hoveredTarget, setHoveredTarget] = useState<{
    type: "node" | "root";
    data: GrowthNode | Root;
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Latest state/hover are read from refs inside the animation loop so the
  // loop itself never needs to restart - only the canvas/renderer lifecycle
  // does. This is what lets growth easing and idle sway animate smoothly
  // between garden-state ticks instead of only redrawing on state changes.
  const stateRef = useRef(state);
  stateRef.current = state;
  const hoveredIdRef = useRef<string | null>(null);
  hoveredIdRef.current =
    hoveredTarget?.type === "node" ? hoveredTarget.data.id : null;

  // Track the container's real on-screen size and keep the canvas's
  // drawing-buffer resolution matched to it (at devicePixelRatio, so it
  // stays crisp on high-DPI screens instead of blurring when CSS scales a
  // lower-resolution buffer up).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const applySize = (width: number, height: number) => {
      if (width < 1 || height < 1) return;
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };

    applySize(container.clientWidth, container.clientHeight);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        applySize(Math.round(width), Math.round(height));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Initialize renderer + continuous render loop. Re-runs whenever the
  // measured size changes so the renderer's internal width/height (used
  // for background gradients, soil placement, etc.) stays in sync.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(size.width * dpr));
    canvas.height = Math.max(1, Math.round(size.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    rendererRef.current = new GardenRenderer2D(ctx, size.width, size.height);

    let rafId: number;
    const loop = (t: number) => {
      rendererRef.current?.render(stateRef.current, hoveredIdRef.current, t);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [size.width, size.height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    const rect = canvas.getBoundingClientRect();
    // CSS size now matches drawing-buffer size 1:1 (both derive from the
    // same measured container), so this is normally an identity scale -
    // kept as a safety net in case the browser rounds CSS layout slightly
    // differently than the ResizeObserver did.
    const scaleX = size.width / rect.width;
    const scaleY = size.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const target = rendererRef.current.hitTest(x, y);

    setHoveredTarget(target);

    if (target) {
      // Store actual screen coordinates for tooltip placement
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleMouseLeave = () => {
    setHoveredTarget(null);
  };

  const handleClick = () => {
    if (hoveredTarget && onClickNode) {
      onClickNode(hoveredTarget.data);
    }
  };

  const handleExport = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `halting-garden-${Date.now()}.png`;
    a.click();
  };

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          cursor: hoveredTarget ? "pointer" : "default",
        }}
      />

      {/* Tooltip */}
      {hoveredTarget && (
        <div
          style={{
            position: "absolute",
            left: mousePos.x + 15,
            top: mousePos.y + 15,
            background: "var(--bg-main)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontFamily: "Inter, sans-serif",
            pointerEvents: "none",
            zIndex: 20,
            minWidth: "150px",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "6px",
              marginBottom: "6px",
              color: "var(--accent-emerald)",
            }}
          >
            {hoveredTarget.type === "node"
              ? (hoveredTarget.data as GrowthNode).type === "branch"
                ? `Function: ${(hoveredTarget.data as GrowthNode).fnName}`
                : (hoveredTarget.data as GrowthNode).type === "whorl"
                  ? "Loop (Whorl)"
                  : "Stem (Root)"
              : `Memory Allocation (Ptr: ${hoveredTarget.data.id})`}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Health</span>
            <span
              style={{
                color:
                  hoveredTarget.data.health < 1
                    ? "var(--accent-rose)"
                    : "var(--text-primary)",
              }}
            >
              {Math.round(hoveredTarget.data.health * 100)}%
            </span>
          </div>
          {hoveredTarget.type === "node" && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>Depth</span>
              <span>{(hoveredTarget.data as GrowthNode).depth}</span>
            </div>
          )}
          {hoveredTarget.type === "root" && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>Size</span>
              <span>{(hoveredTarget.data as Root).size} bytes</span>
            </div>
          )}

          {hoveredTarget.type === "node" &&
            (hoveredTarget.data as GrowthNode).leaves.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "4px",
                    marginTop: "8px",
                  }}
                >
                  Variables
                </div>
                <div
                  style={{
                    background: "var(--bg-surface)",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {(hoveredTarget.data as GrowthNode).leaves.map((leaf) => (
                    <div
                      key={leaf.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        margin: "2px 0",
                      }}
                    >
                      <span style={{ color: "var(--accent-amber)" }}>
                        {leaf.name}
                      </span>
                      <span>{String(leaf.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        title="Export to PNG"
        style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          background: "var(--bg-surface)",
          color: "var(--text-muted)",
          border: "1px solid var(--border-color)",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "color 0.2s, background 0.2s",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.background = "var(--bg-panel)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
          e.currentTarget.style.background = "var(--bg-surface)";
        }}
      >
        <Camera size={18} />
      </button>
    </div>
  );
};
