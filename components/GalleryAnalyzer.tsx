import React, { useState, useRef } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${MAX_FILE_SIZE_MB}Mo).`);
      return;
    }

    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    setResult('');
  };

  const analyzeMedia = async () => {
    if (!mediaUrl || !fileInputRef.current?.files?.[0]) return;
    
    setIsProcessing(true);
    onStatusChange(SessionStatus.ANALYZING);
    setResult('Analyse en cours par Echo-Vision...');
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const file = fileInputRef.current.files[0];
      
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error("Lecture impossible"));
        reader.readAsDataURL(file);
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: file.type } },
            { text: "Tu es Echo-Vision. Décris précisément ce que tu vois sur cette image/vidéo pour une personne malvoyante. IMPORTANT : N'utilise JAMAIS de formattage Markdown comme des astérisques (**). Produis uniquement du texte brut." }
          ]
        }
      });

      const text = response.text || "Aucune analyse disponible.";
      setResult(text);
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      window.speechSynthesis.speak(utterance);

    } catch (err: any) {
      setError("Erreur technique lors de l'analyse.");
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
              <p className="text-white font-black text-xl mb-1 tracking-tight">Importer un média</p>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Image ou Vidéo • Max {MAX_FILE_SIZE_MB}Mo</p>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-10 py-4 bg-cyan-500 text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-cyan-400 transition-colors shadow-xl active:scale-95"
            >
              Parcourir
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

      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-center text-sm font-bold animate-shake">
            {error}
          </div>
        )}

        {mediaUrl && (
          <button
            onClick={analyzeMedia}
            disabled={isProcessing}
            className={`w-full py-6 rounded-3xl font-black text-lg flex items-center justify-center gap-4 transition-all shadow-2xl ${
              isProcessing ? 'bg-white/5 text-white/20' : 'bg-white text-black active:scale-95'
            }`}
          >
            {isProcessing ? (
              <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            )}
            {isProcessing ? 'TRAITEMENT EN COURS...' : 'LANCER L\'ANALYSE'}
          </button>
        )}

        {result && (
          <div className="p-8 bg-white/5 border-l-8 border-cyan-500 rounded-r-[32px] text-lg leading-relaxed animate-in slide-in-from-bottom-6 shadow-2xl overflow-y-auto max-h-60">
            {result}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryAnalyzer;