import React, { useEffect, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { StateField, StateEffect } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet, ViewPlugin, type ViewUpdate } from '@codemirror/view';

const highlightEffect = StateEffect.define<number | null>();

const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(highlightEffect)) {
        if (e.value === null) {
          return Decoration.none;
        }
        const line = tr.state.doc.line(e.value);
        const deco = Decoration.line({ class: 'cm-highlight-line' });
        return Decoration.set([deco.range(line.from)]);
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f)
});

const highlightTheme = EditorView.theme({
  '.cm-highlight-line': {
    backgroundColor: 'rgba(167, 243, 208, 0.15)',
    borderLeft: '3px solid #A7F3D0'
  }
});

// Custom CodeMirror extension to highlight Sprout-specific primitives ('fn', 'alloc', 'free')
const sproutHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.getDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.getDecorations(update.view);
      }
    }
    getDecorations(view: EditorView): DecorationSet {
      const decos: any[] = [];
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        // Find Sprout keywords
        const regex = /\b(fn|alloc|free)\b/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const start = from + match.index;
          const end = start + match[0].length;
          decos.push(
            Decoration.mark({ class: 'cm-sprout-keyword' }).range(start, end)
          );
        }
      }
      return Decoration.set(decos, true);
    }
  },
  {
    decorations: (v) => v.decorations
  }
);

const sproutHighlightTheme = EditorView.theme({
  '.cm-sprout-keyword': {
    color: '#F43F5E', // Distinct vibrant rose/coral accent for Sprout extensions
    fontWeight: 'bold'
  }
});

interface EditorProps {
  code: string;
  onChange: (value: string) => void;
  highlightLine?: number;
}

export const Editor: React.FC<EditorProps> = ({ code, onChange, highlightLine }) => {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    if (highlightLine && editorRef.current?.view) {
      const view = editorRef.current.view;
      const state = view.state;
      if (highlightLine > 0 && highlightLine <= state.doc.lines) {
        const line = state.doc.line(highlightLine);
        view.dispatch({
          effects: [
            highlightEffect.of(highlightLine),
            EditorView.scrollIntoView(line.from, { y: 'center' })
          ]
        });
      }
    }
  }, [highlightLine]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <div style={{ padding: '12px 16px', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>
        Source Code Editor
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <CodeMirror
          ref={editorRef}
          value={code}
          height="100%"
          theme="dark"
          extensions={[javascript(), highlightField, highlightTheme, sproutHighlightPlugin, sproutHighlightTheme]}
          onChange={onChange}
          style={{ height: '100%', fontSize: '13px', fontFamily: '"JetBrains Mono", monospace' }}
        />
      </div>
    </div>
  );
};
