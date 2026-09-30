import React from 'react';
import { RefreshCw, ShieldCheck, Activity } from 'lucide-react';

interface HeaderProps {
  health: any;
  onResetDemo: () => void;
  resetting: boolean;
}

export const Header: React.FC<HeaderProps> = ({ health, onResetDemo, resetting }) => {
  return (
    <header className="gov-header">
      <div className="gov-top-bar">
        <span>GOVERNMENT OF INDIA • DIGITAL PUBLIC INFRASTRUCTURE (DPI) • CIVICTWIN AI DECISION SUPPORT</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>National Informatics Platform</span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} color="#22c55e" /> Verifiable Audit Trail Active
          </span>
        </div>
      </div>
      <div className="gov-main-header">
        <div className="gov-brand">
          <div className="gov-emblem">CT</div>
          <div>
            <h1>CivicTwin AI</h1>
            <div className="gov-tagline">From Citizen Signals to Infrastructure Decisions</div>
          </div>
        </div>

        <div className="gov-header-actions">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: '2px',
              fontSize: '12px',
            }}
          >
            <Activity size={14} color={health?.status === 'HEALTHY' ? '#22c55e' : '#f59e0b'} />
            <span>Core Engine: {health?.status || 'INITIALIZING'}</span>
            <span style={{ opacity: 0.6 }}>•</span>
            <span>Gemini: {health?.gemini?.status || 'ONLINE'}</span>
          </div>

          <button
            className="gov-btn gov-btn-secondary"
            onClick={onResetDemo}
            disabled={resetting}
            title="Reset dataset to deterministic golden demonstration baseline"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <RefreshCw size={14} className={resetting ? 'spin' : ''} />
            {resetting ? 'Resetting Baseline...' : 'Reset Golden Demo'}
          </button>
        </div>
      </div>
    </header>
  );
};
