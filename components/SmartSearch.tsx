import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { SessionStatus } from '../types.ts';

interface SmartSearchProps {
  onStatusChange: (status: SessionStatus) => void;
}

const SmartSearch: React.FC<SmartSearchProps> = ({ onStatusChange }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sources, setSources] = useState<any[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    onStatusChange(SessionStatus.SEARCHING);
    setResponse('');
    setSources([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const pos = await new Promise<GeolocationPosition | null>((res) => 
        navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 5000 })
      );

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: query,
        config: {
          systemInstruction: 'Tu es un assistant pour malvoyants. Réponds de manière claire, concise et utile. IMPORTANT : N\'utilise JAMAIS de formattage Markdown comme les doubles astérisques (**). Ton texte doit être brut et facile à lire par une synthèse vocale.',
          tools: pos ? [{ googleSearch: {} }, { googleMaps: {} }] : [{ googleSearch: {} }],
          toolConfig: pos ? {
            retrievalConfig: {
              latLng: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
              }
            }
          } : undefined
        }
      });

      const text = result.text || "Désolé, je n'ai pas pu obtenir de réponse.";
      setResponse(text);
      
      const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      setSources(chunks);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      window.speechSynthesis.speak(utterance);

    } catch (err) {
      setResponse("Erreur lors de la recherche. Veuillez vérifier votre clé API ou votre connexion.");
    } finally {
      setIsSearching(false);
      onStatusChange(SessionStatus.IDLE);
    }
  };

  return (
    <div className="h-full flex flex-col p-8 animate-in fade-in slide-in-from-right-8 duration-500 bg-[#050505]">
      <div className="mb-10">
        <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">Aide</h2>
        <p className="text-white/40 text-sm font-medium">Posez n'importe quelle question.</p>
      </div>

      <form onSubmit={handleSearch} className="relative mb-8">
        <input 
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: Pharmacie à proximité ?"
          className="w-full bg-white/5 border-2 border-white/5 rounded-3xl py-6 px-7 text-lg focus:border-cyan-500/50 focus:bg-white/10 outline-none transition-all placeholder:text-white/20 shadow-2xl"
        />
        <button 
          type="submit"
          disabled={isSearching}
          className="absolute right-3 top-3 bottom-3 aspect-square bg-cyan-500 text-black rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform disabled:opacity-50"
        >
          {isSearching ? (
            <div className="w-5 h-5 border-3 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </form>

      <div className="flex-1 overflow-y-auto space-y-6 pb-24">
        {response && (
          <div className="bg-white/5 border border-white/5 rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-500">
            <p className="text-xl leading-relaxed text-white/90 mb-6 font-medium">{response}</p>
            
            {sources.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-[10px] font-black uppercase text-cyan-400 mb-4 tracking-[0.2em]">Sources vérifiées :</p>
                <div className="flex flex-wrap gap-2">
                  {sources.map((s, i) => (
                    <a 
                      key={i} 
                      href={s.web?.uri || s.maps?.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] bg-white/5 hover:bg-cyan-500/10 hover:text-cyan-300 px-4 py-2.5 rounded-full text-white/50 transition-all font-bold border border-white/5"
                    >
                      {s.web?.title || s.maps?.title || "En savoir plus"}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartSearch;