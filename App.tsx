import React, { useState } from 'react';
import EchoVision from './components/EchoVision.tsx';
import GalleryAnalyzer from './components/GalleryAnalyzer.tsx';
import { SessionStatus, AppMode } from './types.ts';

const App: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [mode, setMode] = useState<AppMode>('LIVE');

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-100 font-sans overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Top App Bar */}
      <header className="px-6 py-5 flex justify-between items-center z-50 bg-slate-950/40 backdrop-blur-xl border-b border-white/5 shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase italic">
              Echo<span className="text-indigo-400">Vision</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1 px-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${
              status === SessionStatus.ACTIVE ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 
              status === SessionStatus.CONNECTING || status === SessionStatus.ANALYZING ? 'bg-amber-400 animate-bounce' : 'bg-slate-700'
            }`} />
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
              {status}
            </span>
          </div>
        </div>
        
        <button 
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          aria-label="Help and Info"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 relative">
        <div className="absolute inset-0">
          {mode === 'LIVE' && <EchoVision onStatusChange={setStatus} />}
          {mode === 'GALLERY' && <GalleryAnalyzer onStatusChange={setStatus} />}
        </div>
      </main>

      {/* Bottom Floating Navigation */}
      <div className="fixed bottom-8 left-0 right-0 z-50 px-8 pointer-events-none">
        <nav className="max-w-xs mx-auto bg-slate-900/80 backdrop-blur-2xl border border-white/10 p-2 rounded-3xl flex justify-between items-center shadow-2xl pointer-events-auto">
          <button 
            onClick={() => setMode('LIVE')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300 ${
              mode === 'LIVE' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-xs uppercase tracking-widest">Vision</span>
          </button>

          <button 
            onClick={() => setMode('GALLERY')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300 ${
              mode === 'GALLERY' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs uppercase tracking-widest">Media</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;