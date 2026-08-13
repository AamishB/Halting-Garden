import React, { useState, useRef, useEffect } from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  hideBorders?: boolean;
  initialLeftWidth?: number;
}

export const SplitPane: React.FC<SplitPaneProps> = ({ left, right, hideBorders = false, initialLeftWidth = 380 }) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      
      // Constraints (minimum 250px for left, leave at least 400px for right)
      const minWidth = 250;
      const maxWidth = containerRect.width - 400;
      
      if (newWidth > minWidth && newWidth < maxWidth) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const containerStyle: React.CSSProperties = hideBorders 
    ? { width: leftWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    : { width: leftWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', overflow: 'hidden' };

  const rightContainerStyle: React.CSSProperties = hideBorders
    ? { flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }
    : { flex: 1, minWidth: 0, background: 'var(--bg-panel)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' };

  return (
    <div ref={containerRef} style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={containerStyle}>
        {left}
      </div>
      
      {/* Draggable Divider */}
      <div 
        onMouseDown={handleMouseDown}
        style={{
          width: 'var(--gutter)', 
          flexShrink: 0,
          cursor: 'col-resize', 
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ width: '4px', height: '32px', background: 'var(--border-color)', borderRadius: '2px' }} />
      </div>

      <div style={rightContainerStyle}>
        {right}
      </div>
    </div>
  );
};
