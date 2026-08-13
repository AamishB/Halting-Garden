import React from 'react';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onStep,
  onReset,
  speed,
  onSpeedChange
}) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '16px 20px',
      background: 'transparent',
      borderTop: '1px solid var(--border-color)',
      color: 'var(--text-primary)'
    }}>
      <button 
        onClick={onReset}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s' }}
        title="Reset"
      >
        <RotateCcw size={18} />
      </button>

      <button 
        onClick={onTogglePlay}
        style={{ 
          background: 'var(--accent-emerald)', 
          border: 'none', 
          color: 'var(--bg-main)', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
          transition: 'transform 0.1s, background 0.2s'
        }}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
      </button>

      <button 
        onClick={onStep}
        disabled={isPlaying}
        style={{ 
          background: 'transparent', 
          border: 'none', 
          color: isPlaying ? 'var(--bg-surface)' : 'var(--text-muted)', 
          cursor: isPlaying ? 'not-allowed' : 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          transition: 'color 0.2s'
        }}
        title="Step Forward"
      >
        <SkipForward size={18} />
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Speed</span>
        <CustomSelect
          value={speed}
          onChange={(v) => onSpeedChange(Number(v))}
          options={[
            { label: '0.25x', value: 0.25 },
            { label: '0.5x', value: 0.5 },
            { label: '1.0x', value: 1 },
            { label: '2.0x', value: 2 },
            { label: '4.0x', value: 4 },
            { label: '8.0x', value: 8 }
          ]}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px'
          }}
          placement="top"
        />
      </div>
    </div>
  );
};
