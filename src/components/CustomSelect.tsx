import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface Option {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: Option[];
  placeholder?: string;
  style?: React.CSSProperties;
  placement?: 'top' | 'bottom';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  style,
  placement = 'bottom'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : (placeholder || '');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          padding: style?.padding || '10px 16px',
          borderRadius: style?.borderRadius || '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          userSelect: 'none',
          fontSize: style?.fontSize || '14px',
          fontFamily: style?.fontFamily || 'Inter, sans-serif'
        }}
      >
        <span>{displayLabel}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          [placement === 'top' ? 'bottom' : 'top']: '100%',
          right: 0,
          minWidth: '100%',
          [placement === 'top' ? 'marginBottom' : 'marginTop']: '4px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          zIndex: 100,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {options.map((opt, i) => (
            <div
              key={i}
              onClick={() => {
                if (opt.disabled) return;
                onChange(opt.value);
                setIsOpen(false);
              }}
              onMouseEnter={(e) => {
                if (!opt.disabled) {
                  e.currentTarget.style.background = 'var(--accent-emerald)';
                  e.currentTarget.style.color = 'var(--bg-main)';
                }
              }}
              onMouseLeave={(e) => {
                if (!opt.disabled) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              style={{
                padding: '8px 16px',
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                color: opt.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: style?.fontSize || '14px',
                fontFamily: style?.fontFamily || 'Inter, sans-serif',
                userSelect: 'none',
                transition: 'background 0.1s, color 0.1s',
                whiteSpace: 'nowrap'
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
