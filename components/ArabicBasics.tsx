import React, { useState, useCallback, useRef } from 'react';
import { generateTTS, getPronunciationFeedback } from '../services/geminiService';
import { decode, decodeAudioData, blobToBase64 } from '../utils/audio';
import { IconVolume2, IconLoader, IconMicV2, IconStopCircle } from './common/Icons';

const phraseCategories: Record<string, { indonesian: string; arabic: string }[]> = {
  "Sapaan & Dasar": [
    { indonesian: "Halo / Selamat datang", arabic: "مرحباً" },
    { indonesian: "Selamat pagi", arabic: "صباح الخير" },
    { indonesian: "Selamat malam", arabic: "مساء الخير" },
    { indonesian: "Apa kabar?", arabic: "كيف حالك؟" },
    { indonesian: "Saya baik, terima kasih", arabic: "أنا بخير، شكراً" },
    { indonesian: "Siapa nama Anda?", arabic: "ما اسمك؟" },
    { indonesian: "Nama saya...", arabic: "اسمي..." },
    { indonesian: "Dari mana Anda berasal?", arabic: "من أين أنت؟" },
    { indonesian: "Saya dari Indonesia", arabic: "أنا من إندونيسيا" },
    { indonesian: "Terima kasih", arabic: "شكراً" },
    { indonesian: "Sama-sama", arabic: "عفواً" },
    { indonesian: "Permisi", arabic: "لو سمحت" },
    { indonesian: "Maaf", arabic: "آسف" },
    { indonesian: "Ya / Tidak", arabic: "نعم / لا" },
    { indonesian: "Selamat tinggal", arabic: "مع السلامة" },
  ],
  "Di Restoran": [
    { indonesian: "Meja untuk dua orang, tolong", arabic: "طاولة لشخصين من فضلك" },
    { indonesian: "Boleh saya lihat menunya?", arabic: "هل يمكنني رؤية قائمة الطعام؟" },
    { indonesian: "Apa rekomendasi Anda?", arabic: "بماذا تنصح؟" },
    { indonesian: "Saya ingin memesan...", arabic: "أريد أن أطلب..." },
    { indonesian: "Apakah ini pedas?", arabic: "هل هذا حار؟" },
    { indonesian: "Saya mau air putih", arabic: "أريد ماء" },
    { indonesian: "Enak sekali", arabic: "هذا لذيذ جداً" },
    { indonesian: "Minta bonnya", arabic: "الحساب من فضلك" },
  ],
  "Perjalanan (Travel)": [
    { indonesian: "Di mana bandara?", arabic: "أين المطار؟" },
    { indonesian: "Saya mau check-in", arabic: "أريد تسجيل الدخول" },
    { indonesian: "Kapan penerbangannya?", arabic: "متى موعد الرحلة؟" },
    { indonesian: "Saya punya reservasi", arabic: "لدي حجز" },
    { indonesian: "Berapa harga satu malam?", arabic: "كم سعر الليلة الواحدة؟" },
    { indonesian: "Tolong panggilkan taksi", arabic: "اطلب لي سيارة أجرة من فضلك" },
  ],
  "Belanja (Shopping)": [
    { indonesian: "Berapa harganya?", arabic: "بكم هذا؟" },
    { indonesian: "Terlalu mahal", arabic: "هذا غالي جداً" },
    { indonesian: "Apakah Anda punya ukuran lain?", arabic: "هل لديك مقاس آخر؟" },
    { indonesian: "Saya hanya lihat-lihat", arabic: "أنا فقط ألقي نظرة" },
    { indonesian: "Saya akan ambil ini", arabic: "سآخذ هذا" },
    { indonesian: "Bisa bayar dengan kartu kredit?", arabic: "هل تقبلون بطاقة الائتمان؟" },
  ],
  "Menanyakan Arah": [
    { indonesian: "Di mana toilet?", arabic: "أين الحمام؟" },
    { indonesian: "Bagaimana cara ke...?", arabic: "كيف أصل إلى...؟" },
    { indonesian: "Apakah ini jauh?", arabic: "هل هو بعيد؟" },
    { indonesian: "Belok kiri / kanan", arabic: "انعطف يساراً / يميناً" },
    { indonesian: "Lurus saja", arabic: "اذهب مباشرة" },
    { indonesian: "Saya tersesat", arabic: "لقد ضللت طريقي" },
  ],
  "Situasi Darurat": [
    { indonesian: "Tolong!", arabic: "النجدة!" },
    { indonesian: "Saya butuh dokter", arabic: "أحتاج طبيباً" },
    { indonesian: "Panggil polisi!", arabic: "اتصل بالشرطة!" },
    { indonesian: "Di mana rumah sakit terdekat?", arabic: "أين أقرب مستشفى؟" },
    { indonesian: "Saya sakit", arabic: "أنا مريض" },
    { indonesian: "Saya kehilangan paspor saya", arabic: "لقد فقدت جواز سفري" },
  ],
};

type RecordingState = 'idle' | 'listening' | 'recording' | 'processing' | 'feedback';

interface ArabicBasicsProps {
  speechRate: number;
}

const ArabicBasics: React.FC<ArabicBasicsProps> = ({ speechRate }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(Object.keys(phraseCategories)[0]);
  
  const [practicingId, setPracticingId] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);


  const cleanupRecording = () => {
    if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  const startUserRecording = useCallback(async () => {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType });
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        cleanupRecording();
        
        try {
          const base64Audio = await blobToBase64(audioBlob);
          const phrase = phraseCategories[activeCategory].find((_, index) => `${activeCategory}-${index}` === practicingId);
          if (phrase) {
            const receivedFeedback = await getPronunciationFeedback(base64Audio, mimeType, phrase.arabic);
            setFeedback(receivedFeedback);
            setRecordingState('feedback');
          }
        } catch (err) {
            console.error("Error processing audio for feedback:", err);
            setFeedback("Gagal memproses audio Anda. Silakan coba lagi.");
            setRecordingState('feedback');
        }
      };

      mediaRecorderRef.current.start();
      setRecordingState('recording');
      
      recordingTimeoutRef.current = setTimeout(() => {
        if(mediaRecorderRef.current?.state === 'recording'){
            mediaRecorderRef.current.stop();
            setRecordingState('processing');
        }
      }, 7000); // 7-second recording limit

    } catch (err) {
      console.error("Microphone access denied:", err);
      setFeedback("Akses mikrofon ditolak. Periksa pengaturan browser Anda.");
      setRecordingState('feedback');
      setPracticingId(null);
    }
  }, [activeCategory, practicingId]);
  
  const playAudio = useCallback(async (text: string, id: string, onEndedCallback?: () => void) => {
    if (loadingId || playingId) return;
    setLoadingId(id);
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const base64Audio = await generateTTS(text, speechRate);
      if (base64Audio && audioContextRef.current) {
        const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        setPlayingId(id);
        source.onended = () => {
          setPlayingId(null);
          onEndedCallback?.();
        };
        source.start();
      }
    } catch (error) {
      console.error("Error playing audio:", error);
       if (onEndedCallback) { // ensure callback is called on error
            onEndedCallback();
       }
    } finally {
      setLoadingId(null);
    }
  }, [loadingId, playingId, speechRate]);

  const handleStartPractice = useCallback((phraseArabic: string, id: string) => {
    setPracticingId(id);
    setFeedback(null);
    setRecordingState('listening');
    playAudio(phraseArabic, id, startUserRecording);
  }, [playAudio, startUserRecording]);

  const handleStopPractice = useCallback(() => {
    if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setRecordingState('processing');
    }
  }, []);

  const handleCancelPractice = useCallback(() => {
    cleanupRecording();
    setPracticingId(null);
    setRecordingState('idle');
    setFeedback(null);
  }, []);


  const CategoryButton: React.FC<{ category: string }> = ({ category }) => (
    <button
      onClick={() => setActiveCategory(category)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
        activeCategory === category
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {category}
    </button>
  );

  const PracticeView: React.FC<{phrase: {arabic: string}, onStop: () => void, onRetry: () => void, onCancel: () => void}> = ({phrase, onStop, onRetry, onCancel}) => (
    <div className='flex flex-col h-full justify-between'>
        <div className="text-center text-gray-300">
            {recordingState === 'listening' && <p>Dengarkan tutor...</p>}
            {recordingState === 'recording' && 
                <div className="text-center">
                    <p className="animate-pulse text-red-400">Merekam...</p>
                    <p className="text-xs text-gray-400 mt-1">Maksimal 7 detik</p>
                </div>
            }
            {recordingState === 'processing' && <div className="flex justify-center items-center gap-2"><IconLoader /> Menganalisis...</div>}
            {recordingState === 'feedback' && (
                <div>
                    <h4 className="font-bold mb-2 text-blue-400">Umpan Balik:</h4>
                    <p className="text-white">{feedback}</p>
                </div>
            )}
        </div>
        <div className="flex justify-center gap-2 mt-4">
             {recordingState === 'recording' && (
                <button onClick={onStop} className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"><IconStopCircle/></button>
            )}
            {recordingState === 'feedback' && (
                <>
                    <button onClick={onRetry} className="text-sm bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-md">Coba Lagi</button>
                    <button onClick={onCancel} className="text-sm bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded-md">Tutup</button>
                </>
            )}
        </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">Dasar Percakapan Sehari-hari</h2>
      
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {Object.keys(phraseCategories).map(category => (
            <CategoryButton key={category} category={category} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {phraseCategories[activeCategory].map((phrase, index) => {
          const id = `${activeCategory}-${index}`;
          const isLoading = loadingId === id;
          const isPlaying = playingId === id;
          const isPracticing = practicingId === id;

          return (
            <div key={id} className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col justify-between min-h-[150px]">
                {!isPracticing ? (
                    <>
                        <div>
                            <p className="text-gray-400 text-sm mb-2">{phrase.indonesian}</p>
                            <p className="text-white text-2xl font-semibold text-right" dir="rtl">{phrase.arabic}</p>
                        </div>
                        <div className='flex gap-2 mt-4 self-start'>
                            <button
                                onClick={() => playAudio(phrase.arabic, id)}
                                disabled={isLoading || isPlaying || !!practicingId}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white p-2 rounded-full transition-colors duration-200"
                                aria-label={`Ucapkan ${phrase.arabic}`}
                            >
                                {isLoading ? <IconLoader /> : <IconVolume2 />}
                            </button>
                             <button
                                onClick={() => handleStartPractice(phrase.arabic, id)}
                                disabled={isLoading || isPlaying || !!practicingId}
                                className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white p-2 rounded-full transition-colors duration-200"
                                aria-label={`Latih pengucapan ${phrase.arabic}`}
                            >
                                <IconMicV2 />
                            </button>
                        </div>
                    </>
                ) : (
                    <PracticeView 
                        phrase={phrase}
                        onStop={handleStopPractice}
                        onRetry={() => handleStartPractice(phrase.arabic, id)}
                        onCancel={handleCancelPractice}
                    />
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArabicBasics;