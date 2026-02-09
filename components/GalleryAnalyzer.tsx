
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

  // Cleanup URL on unmount
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
    
    // Announce vocally that the file is ready
    const utterance = new SpeechSynthesisUtterance("File loaded. Hold the microphone to ask your question.");
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
      window.navigator.vibrate?.(50); // Haptic feedback
    } catch (err) {
      setError("Cannot access microphone.");
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
    setResult('Echo-Vision is analyzing your request...');
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
            { text: "You are Echo-Vision, an assistant for the visually impaired. Answer the audio question regarding this media. Be precise and concise. IMPORTANT: NEVER use Markdown formatting (**). Respond only in plain text." }
          ]
        }
      });

      const text = response.text || "I couldn't analyze your request.";
      setResult(text);
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);

    } catch (err: any) {
      setError("Error during multimodal analysis.");
      setResult("");
    } finally {
      setIsProcessing(false);
      onStatusChange(SessionStatus.IDLE);
    }
  };

  return (
    <div className="h-full flex flex-col p-8 gap-8 animate-in fade-in duration-700 bg-[#050505]">
      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-[40px] p-6 bg-white/5 overflow-hidden relative shadow-inner">
        {!mediaUrl ? (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto text-cyan-400 border border-white/10">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-black text-xl mb-1 tracking-tight">Import Media</p>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Image or Video • Max {MAX_FILE_SIZE_MB}MB</p>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-10 py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-cyan-400 transition-colors shadow-xl active:scale-95"
            >
              Browse
            </button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center relative rounded-3xl overflow-hidden bg-black">
            {mediaType === 'image' ? (
              <img src={mediaUrl} alt="Preview" className="w-full h-full object-contain" />
            ) : (
              <video src={mediaUrl} controls autoPlay muted playsInline className="w-full h-full object-contain" />
            )}
            <button 
              onClick={() => { setMediaUrl(null); setResult(''); setError(null); }}
              className="absolute top-6 right-6 p-4 bg-rose-600 rounded-full text-white shadow-2xl z-10 active:scale-90"
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

      <div className="flex flex-col items-center gap-6">
        {mediaUrl && (
          <div className="w-full flex flex-col items-center gap-4">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
              {isProcessing ? 'Analyzing...' : isRecording ? 'Listening...' : 'Hold to ask a question'}
            </p>
            
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              disabled={isProcessing}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                isRecording ? 'bg-rose-500 scale-125' : isProcessing ? 'bg-white/10 opacity-50' : 'bg-cyan-500 hover:scale-105 active:scale-90'
              }`}
            >
              {isProcessing ? (
                <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className={`w-10 h-10 ${isRecording ? 'text-white' : 'text-black'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              )}
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" />
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="w-full p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-center text-sm font-bold">
            {error}
          </div>
        )}

        {result && (
          <div className="w-full p-8 bg-white/5 border border-white/10 rounded-[32px] text-lg leading-relaxed animate-in slide-in-from-bottom-6 shadow-2xl overflow-y-auto max-h-48 text-white/90 font-medium">
            {result}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryAnalyzer;
