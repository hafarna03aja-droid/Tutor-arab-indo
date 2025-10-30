import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import type { LiveSession } from '@google/genai';
import { ConversationTurn, Author } from '../types';
import { decode, decodeAudioData, createBlob } from '../utils/audio';
import { translateAndCorrect } from '../services/geminiService';
import { IconMicrophone, IconStopCircle, IconLoader } from './common/Icons';

interface LiveConversationProps {
  speechRate: number;
}

const LiveConversation: React.FC<LiveConversationProps> = ({ speechRate }) => {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [statusText, setStatusText] = useState("Ketuk untuk memulai percakapan");

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const stopListening = useCallback(async () => {
    setIsListening(false);
    setIsLoading(false);
    setStatusText("Ketuk untuk memulai percakapan");

    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      }
      sessionPromiseRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if(scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }

    if(mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
    }

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      await inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        await outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }

  }, []);
  
  const startListening = async () => {
    setIsLoading(true);
    setStatusText("Menghubungkan...");

    try {
        if (!process.env.API_KEY) {
            throw new Error("API KEY not found");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        let nextStartTime = 0;
        const sources = new Set<AudioBufferSourceNode>();

        let rateInstruction = "Bicaralah dengan kecepatan normal.";
        if (speechRate < 0.9) {
            rateInstruction = "Bicaralah dengan sangat perlahan dan jelas.";
        } else if (speechRate > 1.1) {
            rateInstruction = "Bicaralah dengan sedikit lebih cepat dari biasanya.";
        }

        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: async () => {
                    setIsListening(true);
                    setIsLoading(false);
                    setStatusText("Mendengarkan... Bicaralah dalam Bahasa Indonesia");

                    try {
                        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                        if (!inputAudioContextRef.current || inputAudioContextRef.current.state === 'closed') return;
                        
                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    } catch (err) {
                        console.error("Microphone access denied:", err);
                        setStatusText("Akses mikrofon ditolak. Periksa pengaturan Anda.");
                        stopListening();
                    }
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                    }
                    if (message.serverContent?.outputTranscription) {
                        currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                    }

                    if (message.serverContent?.turnComplete) {
                        const userText = currentInputTranscriptionRef.current.trim();
                        const tutorText = currentOutputTranscriptionRef.current.trim();
                        
                        currentInputTranscriptionRef.current = '';
                        currentOutputTranscriptionRef.current = '';

                        if (userText && tutorText) {
                            const userTurnId = `user-${Date.now()}`;
                            
                            // Update UI immediately with placeholder
                            setConversation(prev => [
                                ...prev,
                                {
                                    id: userTurnId,
                                    author: Author.USER,
                                    indonesianText: userText,
                                    arabicText: ' Menerjemahkan...', // Placeholder
                                },
                                {
                                    id: `tutor-${Date.now()}`,
                                    author: Author.TUTOR,
                                    arabicText: tutorText,
                                }
                            ]);

                            // Translate in the background and update the turn
                            (async () => {
                                const translatedUserText = await translateAndCorrect(userText);
                                setConversation(prev => prev.map(turn => 
                                    turn.id === userTurnId 
                                    ? { ...turn, arabicText: translatedUserText } 
                                    : turn
                                ));
                            })();
                        }
                    }

                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
                        nextStartTime = Math.max(nextStartTime, outputAudioContextRef.current.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                        const source = outputAudioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContextRef.current.destination);
                        source.addEventListener('ended', () => sources.delete(source));
                        source.start(nextStartTime);
                        nextStartTime += audioBuffer.duration;
                        sources.add(source);
                    }
                },
                onclose: () => {
                    stopListening();
                },
                onerror: (e: ErrorEvent) => {
                    console.error("Session error:", e);
                    setStatusText("Koneksi gagal. Periksa kunci API & jaringan Anda.");
                    stopListening();
                }
            },
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                },
                systemInstruction: `Anda adalah seorang guru Bahasa Arab yang interaktif dan sangat menarik. Pengguna, seorang pemula, akan berbicara dalam Bahasa Indonesia. ${rateInstruction} Peran Anda adalah untuk: 1. Merespons pertanyaan mereka dalam Bahasa Arab yang sederhana dan jelas. 2. Setelah merespons, secara aktif dorong mereka untuk belajar dengan meminta mereka mengulangi frasa Arab yang baru saja Anda ucapkan. Misalnya, katakan 'Sekarang coba ulangi...' 3. Jika mereka mencoba berbicara dalam Bahasa Arab dan membuat kesalahan (yang akan Anda simpulkan dari konteks Bahasa Indonesia yang mereka ucapkan), koreksi mereka dengan lembut. Jelaskan koreksi secara singkat dalam Bahasa Indonesia sebelum memberikan frasa Arab yang benar. Jadilah sangat memberi semangat dan sabar. Tujuan Anda adalah menjadikan percakapan ini sesi belajar aktif, bukan hanya tanya jawab.`,
            }
        });
    } catch (error) {
        console.error("Failed to start listening:", error);
        setStatusText("Gagal memulai. Periksa konsol untuk detail.");
        setIsLoading(false);
    }
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopListening();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const TurnMessage: React.FC<{ turn: ConversationTurn }> = ({ turn }) => {
    if (turn.author === Author.USER) {
      const isTranslating = turn.arabicText === ' Menerjemahkan...';
      return (
        <div className="flex justify-end mb-4">
          <div className="bg-blue-600 rounded-lg p-3 max-w-xs md:max-w-md">
            <p className="text-white text-sm">{turn.indonesianText}</p>
            <p 
              className={`text-lg mt-2 text-right ${isTranslating ? 'text-blue-300 italic' : 'text-blue-200'}`}
              dir={isTranslating ? 'ltr' : 'rtl'}
            >
              {turn.arabicText}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-start mb-4">
        <div className="bg-gray-700 rounded-lg p-3 max-w-xs md:max-w-md">
          <p className="text-gray-300 text-sm font-bold mb-1">Tutor</p>
          <p className="text-white text-lg text-right" dir="rtl">{turn.arabicText}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex-1 overflow-y-auto p-4 bg-gray-800 rounded-t-lg">
         {conversation.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-400 text-center">
                Mulai percakapan dengan menekan tombol mikrofon di bawah.
            </div>
         )}
        {conversation.map((turn) => <TurnMessage key={turn.id} turn={turn} />)}
        <div ref={conversationEndRef} />
      </div>
      <div className="bg-gray-700 p-4 rounded-b-lg flex flex-col items-center">
        <button
          onClick={handleToggleListening}
          disabled={isLoading}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform
            ${isLoading ? 'bg-gray-500 cursor-not-allowed' : 
            isListening ? 'bg-red-600 hover:bg-red-700 scale-105' : 
            'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isLoading ? <IconLoader /> : isListening ? <IconStopCircle /> : <IconMicrophone />}
        </button>
        <p className="mt-3 text-sm text-gray-300 h-5">{statusText}</p>
      </div>
    </div>
  );
};

export default LiveConversation;