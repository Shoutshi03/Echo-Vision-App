import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { SessionStatus } from '../types.ts';

interface GalleryAnalyzerProps {
  onStatusChange: (status: SessionStatus) => void;
}

const MAX_FILE_SIZE_MB = 10;

const GalleryAnalyzer: React.FC<GalleryAnalyzerProps> = ({ onStatusChange }) => {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [result, setResult] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File too large (max ${MAX_FILE_SIZE_MB}MB).`);
      return;
    }

    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    setResult('');
    
    const utterance = new SpeechSynthesisUtterance("Ready. Hold the button to ask a question.");
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        processMultimodal(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      window.navigator.vibrate?.(50);
    } catch (err) {
      setError("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const processMultimodal = async (audioBlob: Blob) => {
    if (!mediaUrl || !fileInputRef.current?.files?.[0]) return;

    setIsProcessing(true);
    onStatusChange(SessionStatus.ANALYZING);
    setResult('');
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const mediaFile = fileInputRef.current.files[0];
      
      const [mediaBase64, audioBase64] = await Promise.all([
        blobToBase64(mediaFile),
        blobToBase64(audioBlob)
      ]);

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: mediaBase64, mimeType: mediaFile.type } },
            { inlineData: { data: audioBase64, mimeType: 'audio/webm' } },
            { text: "Analyze the content and answer the question concisely for a visually impaired user. Plain text only, no markdown." }
          ]
        }
      });

      const text = response.text || "I couldn't process that.";
      setResult(text);
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);

    } catch (err: any) {
      setError("Analysis failed. Please try again.");
      setResult("");
    } finally {
      setIsProcessing(false);
      onStatusChange(SessionStatus.IDLE);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6 animate-in fade-in duration-700 bg-slate-950 pb-32">
      {/* Media Preview Area */}
      <div className="flex-1 flex flex-col items-center justify-center border-2 border-slate-800 rounded-[48px] bg-slate-900/40 overflow-hidden relative group transition-all duration-500 hover:border-indigo-500/30">
        {!mediaUrl ? (
          <div className="text-center space-y-8 px-6">
            <div className="w-24 h-24 bg-indigo-500/10 rounded-[32px] flex items-center justify-center mx-auto text-indigo-400 border border-white/5 shadow-inner">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-white font-bold text-2xl tracking-tight">Media Assistant</p>
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest leading-relaxed">
                Analyze images or videos<br/>up to {MAX_FILE_SIZE_MB}MB
              </p>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
            >
              Select File
            </button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center relative bg-slate-950">
            {mediaType === 'image' ? (
              <img src={mediaUrl} alt="Preview" className="w-full h-full object-contain" />
            ) : (
              <video src={mediaUrl} controls autoPlay muted playsInline className="w-full h-full object-contain" />
            )}
            <button 
              onClick={() => { setMediaUrl(null); setResult(''); setError(null); }}
              className="absolute top-6 right-6 p-4 bg-slate-900/80 backdrop-blur-lg rounded-full text-white/50 hover:text-rose-400 transition-colors shadow-2xl z-10"
              aria-label="Remove media"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*,video/*" 
          onChange={handleFileUpload} 
          className="hidden" 
        />
      </div>

      {/* Interaction Area */}
      <div className="flex flex-col items-center gap-6">
        {mediaUrl && (
          <div className="w-full flex flex-col items-center gap-6">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-6 py-2">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                  <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin" />
                </div>
                <div className="flex gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
                {isRecording ? 'Listening...' : 'Hold Mic to ask Question'}
              </p>
            )}
            
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              disabled={isProcessing}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                isRecording 
                  ? 'bg-rose-500 scale-110 shadow-rose-500/40' 
                  : isProcessing 
                    ? 'bg-slate-800 opacity-40 grayscale' 
                    : 'bg-indigo-600 hover:scale-105 active:scale-95 shadow-indigo-600/40'
              }`}
            >
              {isProcessing ? (
                <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
              {isRecording && (
                <div className="absolute inset-[-12px] rounded-full border-4 border-rose-500/20 animate-ping" />
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="w-full p-5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-[24px] text-center text-xs font-bold animate-in slide-in-from-bottom-2">
            {error}
          </div>
        )}

        {result && (
          <div className="w-full p-8 bg-slate-900 border border-white/5 rounded-[40px] text-lg leading-tight animate-in slide-in-from-bottom-8 shadow-2xl overflow-y-auto max-h-56 text-slate-100 font-medium tracking-tight">
            <div className="mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-indigo-500 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Response</span>
            </div>
            {result}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryAnalyzer;