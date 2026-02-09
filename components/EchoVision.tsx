
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

  const stopSession = useCallback(() => {
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
  }, [onStatusChange]);

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
      const outputNode = audioContextOutputRef.current.createGain();
      outputNode.connect(audioContextOutputRef.current.destination);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          systemInstruction: 'You are Echo-Vision, a real-time visual assistant for the visually impaired. Analyze the video feed and describe obstacles, text, and important changes concisely. Speak directly in English. IMPORTANT: NEVER use Markdown formatting like asterisks (**) in your spoken responses. Use plain text only.',
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            onStatusChange(SessionStatus.ACTIVE);
            
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
          onerror: () => stopSession(),
          onclose: () => stopSession()
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      setError({ title: "Access Denied", detail: err.message || "Please enable permissions." });
      onStatusChange(SessionStatus.ERROR);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden relative">
      <div className={`fixed inset-0 transition-opacity duration-1000 pointer-events-none ${isActive ? 'opacity-70 scale-100' : 'opacity-0 scale-105'}`}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="z-20 flex flex-col items-center gap-8 w-full px-8 text-center max-w-lg">
        {!isActive && !error && (
          <div className="mb-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h2 className="text-3xl font-black text-cyan-400 mb-4 tracking-tighter uppercase">Welcome to Echo-Vision</h2>
            <p className="text-white/60 text-sm font-medium leading-relaxed max-w-xs mx-auto mb-8">
              Your eyes through AI. Echo-Vision uses Gemini 3 to describe your surroundings and help you navigate the world.
            </p>
            <div className="grid grid-cols-1 gap-4 text-left">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-xl">👁️</div>
                <div className="flex-1">
                  <p className="text-xs font-black text-white/90 uppercase tracking-widest">Live Vision</p>
                  <p className="text-[10px] text-white/40">Real-time description of obstacles and objects.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-xl">🎙️</div>
                <div className="flex-1">
                  <p className="text-xs font-black text-white/90 uppercase tracking-widest">Voice Media</p>
                  <p className="text-[10px] text-white/40">Upload files and ask questions using your voice.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {isActive && (
           <div className="w-full min-h-[140px] bg-white/5 backdrop-blur-3xl rounded-[32px] p-8 border border-white/10 flex items-center justify-center shadow-2xl animate-in slide-in-from-top-12 duration-500">
             <p className="text-xl font-medium text-white/90 leading-relaxed tracking-tight">
               {lastMessage || "Echo-Vision is analyzing..."}
             </p>
           </div>
        )}

        <div className="relative">
          <button
            onClick={isActive ? stopSession : startSession}
            className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all duration-500 border-[10px] active:scale-95 ${
              isActive ? 'bg-rose-500 border-rose-400/30' : 'bg-cyan-500 border-cyan-400/30 shadow-[0_0_50px_rgba(34,211,238,0.2)]'
            }`}
          >
            {isActive ? (
              <div className="flex flex-col items-center gap-4 text-white">
                <div className="flex items-center gap-1.5 h-10">
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
                <span className="text-xs font-black uppercase tracking-widest">Listening</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-white">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-xs font-black uppercase tracking-widest">Activate</span>
              </div>
            )}
          </button>
          
          {isActive && (
            <div className="absolute inset-0 -z-10 bg-rose-500/30 rounded-full animate-ping" />
          )}
        </div>

        {error && (
          <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-3xl text-rose-200 text-sm font-bold animate-bounce">
            {error.title}: {error.detail}
            <button 
              onClick={() => setError(null)}
              className="mt-4 block mx-auto text-[10px] uppercase font-black text-white/40 underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {!isActive && (
        <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 animate-pulse">
            Ready to assist
          </p>
        </div>
      )}
    </div>
  );
};

export default EchoVision;
