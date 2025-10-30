import React, { useState, useRef, useCallback } from 'react';
import { translateText, generateTTS } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audio';
import { IconLoader, IconVolume2 } from './common/Icons';

interface TextTranslatorProps {
    speechRate: number;
}

const TextTranslator: React.FC<TextTranslatorProps> = ({ speechRate }) => {
    const [indonesianText, setIndonesianText] = useState<string>('');
    const [arabicText, setArabicText] = useState<string>('');
    const [isTranslating, setIsTranslating] = useState<boolean>(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioCacheRef = useRef<Record<string, string>>({}); // Cache for TTS results <arabicText, base64Audio>

    const handleTranslate = async () => {
        if (!indonesianText.trim()) return;
        setIsTranslating(true);
        setError(null);
        setArabicText('');
        try {
            const translation = await translateText(indonesianText);
            setArabicText(translation);
        } catch (err) {
            console.error(err);
            setError("Gagal menerjemahkan. Silakan coba lagi.");
        } finally {
            setIsTranslating(false);
        }
    };

    const playAudio = useCallback(async (text: string) => {
        if (!text || isGeneratingAudio) return;
        
        setIsGeneratingAudio(true);
        setError(null);

        try {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            
            // Invalidate cache if speech rate changes
            const cacheKey = `${text}-${speechRate}`;
            let base64Audio = audioCacheRef.current[cacheKey];

            if (!base64Audio) {
                const generatedAudio = await generateTTS(text, speechRate);
                if (generatedAudio) {
                    base64Audio = generatedAudio;
                    audioCacheRef.current[cacheKey] = base64Audio;
                } else {
                    throw new Error("Gagal menghasilkan audio.");
                }
            }

            if (base64Audio && audioContextRef.current) {
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.start();
            }
        } catch (error) {
            console.error("Error playing audio:", error);
            setError("Gagal memutar audio. Silakan coba lagi.");
        } finally {
            setIsGeneratingAudio(false);
        }
    }, [isGeneratingAudio, speechRate]);

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <h2 className="text-3xl font-bold text-center text-blue-400">Penerjemah Teks</h2>
            <p className="text-center text-gray-400 -mt-4">
                Ketik teks dalam Bahasa Indonesia untuk diterjemahkan ke Bahasa Arab.
            </p>

            {/* Input Card */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <label htmlFor="indonesian-text" className="block mb-2 text-sm font-medium text-gray-300">
                    Teks Indonesia
                </label>
                <textarea
                    id="indonesian-text"
                    rows={4}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Contoh: Selamat pagi, apa kabar?"
                    value={indonesianText}
                    onChange={(e) => setIndonesianText(e.target.value)}
                    disabled={isTranslating}
                />
                <button
                    onClick={handleTranslate}
                    disabled={isTranslating || !indonesianText.trim()}
                    className="mt-4 w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
                >
                    {isTranslating ? <><IconLoader /> Menerjemahkan...</> : 'Terjemahkan'}
                </button>
            </div>

            {/* Output Card */}
            {(arabicText || isTranslating) && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <label className="block mb-2 text-sm font-medium text-gray-300">
                        Terjemahan Arab
                    </label>
                    <div className="w-full min-h-[100px] p-3 bg-gray-700 border border-gray-600 rounded-md text-white text-2xl flex items-center">
                        {isTranslating ? (
                            <div className="w-full flex justify-center text-gray-400">
                               <IconLoader />
                            </div>
                        ) : (
                            <p className="w-full text-right" dir="rtl">{arabicText}</p>
                        )}
                    </div>
                    {arabicText && !isTranslating && (
                        <button
                            onClick={() => playAudio(arabicText)}
                            disabled={isGeneratingAudio}
                            className="mt-4 w-full flex justify-center items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
                        >
                            {isGeneratingAudio ? <><IconLoader /> Memutar...</> : <><IconVolume2 /> Ucapkan</>}
                        </button>
                    )}
                </div>
            )}
            
            {error && (
                <div className="text-center text-red-400 bg-red-900/50 p-3 rounded-md">
                    {error}
                </div>
            )}
        </div>
    );
};

export default TextTranslator;