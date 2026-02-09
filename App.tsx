
import React, { useState } from 'react';
import EchoVision from './components/EchoVision.tsx';
import GalleryAnalyzer from './components/GalleryAnalyzer.tsx';
import { SessionStatus, AppMode } from './types.ts';

const App: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [mode, setMode] = useState<AppMode>('LIVE');

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Top App Bar */}
      <header className="px-6 py-4 flex justify-between items-center z-50 bg-black/60 backdrop-blur-2xl border-b border-white/5 shrink-0">
        <div>
          <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent uppercase">
            Echo Vision
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${
              status === SessionStatus.ACTIVE ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 
              status === SessionStatus.CONNECTING || status === SessionStatus.ANALYZING ? 'bg-amber-500 animate-bounce' : 'bg-white/20'
            }`} />
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
              {status}
            </span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 relative">
        <div className="absolute inset-0">
          {mode === 'LIVE' && <EchoVision onStatusChange={setStatus} />}
          {mode === 'GALLERY' && <GalleryAnalyzer onStatusChange={setStatus} />}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="z-50 bg-black/90 backdrop-blur-3xl border-t border-white/5 px-12 pt-3 pb-8 safe-area-bottom shrink-0 flex justify-around items-center">
        <button 
          onClick={() => setMode('LIVE')}
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${mode === 'LIVE' ? 'text-cyan-400 scale-110' : 'text-white/30'}`}
        >
          <div className={`p-2 rounded-xl transition-colors ${mode === 'LIVE' ? 'bg-cyan-500/10' : ''}`}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Vision</span>
        </button>

        <button 
          onClick={() => setMode('GALLERY')}
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${mode === 'GALLERY' ? 'text-cyan-400 scale-110' : 'text-white/30'}`}
        >
          <div className={`p-2 rounded-xl transition-colors ${mode === 'GALLERY' ? 'bg-cyan-500/10' : ''}`}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Media</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
