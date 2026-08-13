import { useMemo } from 'react';
import type { ExecEvent } from '../sprout/types';

interface InspectorPanelProps {
  events: ExecEvent[];
  currentTick: number;
}

export function InspectorPanel({ events, currentTick }: InspectorPanelProps) {
  // Reconstruct state at the exact tick
  const stateAtTick = useMemo(() => {
    const callStack: any[] = [];
    let currentScope = {};
    const heap = new Map<string, any>();
    
    // We replay up to currentTick
    for (let i = 0; i < currentTick; i++) {
      const event = events[i];
      if (!event) continue;
      
      switch (event.type) {
        case 'call_enter':
          callStack.push({
            nodeId: event.nodeId,
            fnName: event.fnName,
            args: event.args,
            locals: {} // To be populated by var_declare
          });
          break;
        case 'call_exit':
          callStack.pop();
          break;
        case 'var_declare':
          if (callStack.length > 0) {
            callStack[callStack.length - 1].locals[event.name] = (event as any).value;
          } else {
            (currentScope as any)[event.name] = (event as any).value;
          }
          break;
        case 'var_assign':
          let found = false;
          for (let j = callStack.length - 1; j >= 0; j--) {
            if (event.name in callStack[j].locals) {
              callStack[j].locals[event.name] = (event as any).newValue;
              found = true;
              break;
            }
          }
          if (!found) {
            (currentScope as any)[event.name] = (event as any).newValue;
          }
          break;
        case 'alloc':
          heap.set(event.ptrId, event.size);
          break;
        case 'free':
          heap.delete(event.ptrId);
          break;
      }
    }
    
    return { callStack, globalScope: currentScope, heap };
  }, [events, currentTick]);

  const { callStack, globalScope, heap } = stateAtTick;
  const currentFrame = callStack.length > 0 ? callStack[callStack.length - 1] : null;
  const locals = currentFrame ? currentFrame.locals : globalScope;

  return (
    <div style={{ padding: '16px', color: 'var(--text-primary)', height: '100%', overflowY: 'auto', background: 'var(--bg-panel)' }}>
      <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>Inspector</h2>
      
      {/* Call Stack Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Call Stack</h3>
        {callStack.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>(Global Scope)</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px' }}>
            {callStack.map((frame, idx) => (
              <li key={frame.nodeId} style={{ 
                padding: '6px 8px', 
                background: idx === callStack.length - 1 ? 'var(--bg-surface)' : 'transparent',
                borderLeft: idx === callStack.length - 1 ? '2px solid var(--accent-emerald)' : '2px solid transparent',
                marginBottom: '2px',
                fontFamily: 'monospace'
              }}>
                {frame.fnName}({frame.args?.map(String).join(', ')})
              </li>
            )).reverse()}
          </ul>
        )}
      </div>

      {/* Variables Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
          {currentFrame ? 'Local Variables' : 'Global Variables'}
        </h3>
        {Object.keys(locals).length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No variables in scope</div>
        ) : (
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <tbody>
              {Object.entries(locals).map(([name, value]) => (
                <tr key={name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '6px 0', color: 'var(--accent-amber)', fontFamily: 'monospace' }}>{name}</td>
                  <td style={{ padding: '6px 0', fontFamily: 'monospace' }}>{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Heap Section */}
      {heap.size > 0 && (
        <div>
          <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Heap Allocations</h3>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ paddingBottom: '4px', fontWeight: 'normal' }}>Pointer</th>
                <th style={{ paddingBottom: '4px', fontWeight: 'normal' }}>Size</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(heap.entries()).map(([ptr, size]) => (
                <tr key={ptr}>
                  <td style={{ padding: '6px 0', color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>{ptr}</td>
                  <td style={{ padding: '6px 0', fontFamily: 'monospace' }}>{size} bytes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
