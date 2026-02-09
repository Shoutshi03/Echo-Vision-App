import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { SessionStatus } from '../types.ts';

interface EchoVisionProps {
  onStatusChange: (status: SessionStatus) => void;
}

const FRAME_RATE = 1.5; 
const JPEG_QUALITY = 0.4;

const EchoVision: React.FC<EchoVisionProps> = ({ onStatusChange }) => {
  const [isActive, setIsActive] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>('');
  const [error, setError] = useState<{title: string, detail: string} | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextInputRef = useRef<AudioContext | null>(null);
  const audioContextOutputRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const frameIntervalRef = useRef<number | null>(null);

  // Sound Cues Utility using Web Audio API
  const playSoundCue = useCallback((type: 'connecting' | 'active' | 'error' | 'stop') => {
    const ctx = audioContextOutputRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case 'connecting':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      case 'active':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      case 'error':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.4);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      case 'stop':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(220, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
    }
  }, []);

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) => {
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const stopSession = useCallback((silent = false) => {
    if (!silent && isActive) playSoundCue('stop');
    setIsActive(false);
    onStatusChange(SessionStatus.IDLE);
    if (frameIntervalRef.current) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    sourcesRef.current.forEach(source => { try { source.stop(); } catch(e){} });
    sourcesRef.current.clear();
    
    if (audioContextInputRef.current) {
      audioContextInputRef.current.close();
      audioContextInputRef.current = null;
    }
    if (audioContextOutputRef.current) {
      audioContextOutputRef.current.close();
      audioContextOutputRef.current = null;
    }
    
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [onStatusChange, isActive, playSoundCue]);

  const startSession = async () => {
    setError(null);
    try {
      onStatusChange(SessionStatus.CONNECTING);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } 
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      audioContextInputRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextOutputRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      playSoundCue('connecting');

      const outputNode = audioContextOutputRef.current.createGain();
      outputNode.connect(audioContextOutputRef.current.destination);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            // Using 'Kore' which is a pleasant feminine voice
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: 'You are Echo-Vision, a real-time visual assistant for the visually impaired. Analyze the video feed and describe obstacles, text, and important changes concisely. Speak directly in English. IMPORTANT: NEVER use Markdown formatting like asterisks (**) in your spoken responses. Use plain text only.',
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            onStatusChange(SessionStatus.ACTIVE);
            playSoundCue('active');
            
            if (audioContextInputRef.current) {
              const source = audioContextInputRef.current.createMediaStreamSource(stream);
              const scriptProcessor = audioContextInputRef.current.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                sessionPromise.then(session => {
                  if (session) session.sendRealtimeInput({ 
                    media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } 
                  });
                });
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(audioContextInputRef.current.destination);
            }

            frameIntervalRef.current = window.setInterval(() => {
              if (canvasRef.current && videoRef.current && videoRef.current.videoWidth > 0) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  canvasRef.current.width = videoRef.current.videoWidth;
                  canvasRef.current.height = videoRef.current.videoHeight;
                  ctx.drawImage(videoRef.current, 0, 0);
                  const base64Data = canvasRef.current.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
                  sessionPromise.then(session => {
                    if (session) session.sendRealtimeInput({
                      media: { data: base64Data, mimeType: 'image/jpeg' }
                    });
                  });
                }
              }
            }, 1000 / FRAME_RATE);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              setLastMessage(message.serverContent.outputTranscription.text);
            }
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextOutputRef.current) {
              const ctx = audioContextOutputRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputNode);
              source.onended = () => sourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: () => {
            playSoundCue('error');
            stopSession(true);
          },
          onclose: () => stopSession()
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      playSoundCue('error');
      setError({ title: "Access Denied", detail: err.message || "Please enable permissions." });
      onStatusChange(SessionStatus.ERROR);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 overflow-hidden relative">
      {/* Background Video Context */}
      <div className={`fixed inset-0 transition-all duration-1000 pointer-events-none ${isActive ? 'opacity-40 scale-100 blur-sm' : 'opacity-0 scale-110 blur-xl'}`}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/20 to-slate-950" />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="z-20 flex flex-col items-center gap-10 w-full px-10 text-center max-w-xl pb-32">
        {!isActive && !error && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="space-y-2">
              <h2 className="text-4xl font-extrabold text-white tracking-tight">
                Hi, I'm <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Echo</span>
              </h2>
              <p className="text-slate-400 text-base font-medium leading-relaxed max-w-sm mx-auto">
                Point your camera and tap below. I'll describe the world around you in real-time.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-4 text-left w-full">
              <div className="group flex items-center gap-4 p-5 rounded-3xl bg-slate-900/50 border border-white/5 backdrop-blur-sm transition-all hover:bg-slate-800/50">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">👁️</div>
                <div>
                  <p className="text-sm font-bold text-slate-100 uppercase tracking-wider">Object Awareness</p>
                  <p className="text-xs text-slate-500">Know what's in front of you instantly.</p>
                </div>
              </div>
              <div className="group flex items-center gap-4 p-5 rounded-3xl bg-slate-900/50 border border-white/5 backdrop-blur-sm transition-all hover:bg-slate-800/50">
                <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🚶</div>
                <div>
                  <p className="text-sm font-bold text-slate-100 uppercase tracking-wider">Safe Navigation</p>
                  <p className="text-xs text-slate-500">Detect obstacles and changing paths.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {isActive && (
           <div className="w-full min-h-[160px] bg-slate-900/80 backdrop-blur-3xl rounded-[40px] p-8 border border-white/10 flex items-center justify-center shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 animate-pulse" />
             <p className="text-2xl font-semibold text-white/95 leading-tight tracking-tight">
               {lastMessage || "Looking at your surroundings..."}
             </p>
           </div>
        )}

        <div className="relative group">
          <button
            onClick={isActive ? stopSession : startSession}
            className={`relative w-56 h-56 rounded-full flex flex-col items-center justify-center transition-all duration-700 shadow-2xl active:scale-90 ${
              isActive 
                ? 'bg-rose-500 border-[12px] border-rose-400/20' 
                : 'bg-indigo-600 border-[12px] border-indigo-500/20 hover:bg-indigo-500 hover:shadow-indigo-500/40'
            }`}
          >
            {isActive ? (
              <div className="flex flex-col items-center gap-4 text-white">
                <div className="flex items-center gap-2 h-12">
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-white rounded-full animate-bounce"
                      style={{ 
                        height: `${30 + Math.random() * 70}%`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.6s'
                      }} 
                    />
                  ))}
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Stop Assistant</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-white">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md mb-2">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <span className="text-xs font-black uppercase tracking-[0.4em]">Initialize</span>
              </div>
            )}
          </button>
          
          {isActive && (
            <>
              <div className="absolute inset-[-20px] -z-10 bg-rose-500/10 rounded-full animate-ping duration-1000" />
              <div className="absolute inset-[-40px] -z-20 bg-rose-500/5 rounded-full animate-ping delay-300 duration-1000" />
            </>
          )}
          {!isActive && (
            <div className="absolute inset-[-10px] -z-10 bg-indigo-500/20 rounded-full animate-pulse blur-xl" />
          )}
        </div>

        {error && (
          <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-200 text-sm font-bold animate-in slide-in-from-bottom-4">
            <p className="mb-3">{error.title}: {error.detail}</p>
            <button 
              onClick={() => setError(null)}
              className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/40 rounded-xl text-[10px] uppercase font-black transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {!isActive && (
        <div className="absolute bottom-24 left-0 right-0 text-center pointer-events-none opacity-20">
          <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white">
            Ready to assist • 100% Privacy
          </p>
        </div>
      )}
    </div>
  );
};

export default EchoVision;