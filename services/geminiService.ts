import { GoogleGenAI, Modality } from "@google/genai";

let ai: GoogleGenAI;

function getAi() {
  if (!ai) {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
}

export const generateTTS = async (text: string, rate: number = 1.0): Promise<string | null> => {
  try {
    const gemini = getAi();
    
    let promptText = `Tolong ucapkan dalam bahasa Arab: ${text}`;
    if (rate < 0.9) { // Slow
        promptText = `Tolong ucapkan dengan perlahan dalam bahasa Arab: ${text}`;
    } else if (rate > 1.1) { // Fast
        promptText = `Tolong ucapkan dengan cepat dalam bahasa Arab: ${text}`;
    }

    const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Error generating TTS:", error);
    return null;
  }
};

export const translateAndCorrect = async (text: string): Promise<string> => {
    if (!text.trim()) {
        return "";
    }
    try {
        const gemini = getAi();
        // Prompt is more focused on direct, high-quality translation.
        const prompt = `Anda adalah penerjemah profesional khusus Bahasa Indonesia ke Bahasa Arab. Tugas Anda adalah menerjemahkan teks yang diberikan secara akurat dan alami. JANGAN memberikan penjelasan, transliterasi, atau teks tambahan apa pun. Hanya berikan hasil terjemahan dalam Bahasa Arab.\n\nTeks Indonesia: "${text}"`;
        
        const response = await gemini.models.generateContent({
            // Using a more powerful model for better translation quality.
            model: 'gemini-2.5-pro',
            contents: prompt,
        });
        
        const resultText = response.text;
        if (typeof resultText === 'string') {
          return resultText.trim();
        }

        console.warn("Translation/correction response did not contain text.", response);
        return "Gagal menerjemahkan.";
    } catch (error) {
        console.error("Error in translation/correction:", error);
        return "Terjadi kesalahan saat menerjemahkan.";
    }
};

export const translateText = async (text: string): Promise<string> => {
    if (!text.trim()) {
        return "";
    }
    try {
        const gemini = getAi();
        const prompt = `Anda adalah penerjemah ahli Indonesia-Arab. Terjemahkan teks berikut ke Bahasa Arab. Hanya berikan hasil terjemahannya saja, tanpa teks atau penjelasan tambahan.\n\nTeks Pengguna: "${text}"`;
        
        const response = await gemini.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        const resultText = response.text;
        if (typeof resultText === 'string') {
          return resultText.trim();
        }

        console.warn("Translation response did not contain text.", response);
        return "Maaf, saya tidak bisa menerjemahkan itu.";
    } catch (error) {
        console.error("Error in translation:", error);
        return "Terjadi kesalahan saat menerjemahkan.";
    }
};

export const getPronunciationFeedback = async (
    audioBase64: string,
    mimeType: string,
    correctPhrase: string
): Promise<string> => {
    try {
        const gemini = getAi();
        const audioPart = {
            inlineData: {
                mimeType: mimeType,
                data: audioBase64,
            },
        };

        const textPart = {
            text: `Evaluasi pelafalan pengguna berdasarkan audio yang diberikan. Pengguna mencoba mengucapkan frasa Arab: "${correctPhrase}". Berikan umpan balik yang membangun dan singkat dalam Bahasa Indonesia (2-3 kalimat). Mulailah dengan dorongan, lalu berikan saran jika perlu.`,
        };

        const response = await gemini.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, textPart] },
            config: {
                systemInstruction: "Anda adalah seorang pelatih pelafalan Bahasa Arab yang ramah dan mendukung. Tugas Anda adalah memberikan umpan balik yang jelas dan sederhana untuk membantu pelajar pemula.",
            },
        });

        const resultText = response.text;
        if (typeof resultText === 'string') {
          return resultText.trim();
        }
        
        return "Tidak dapat menerima umpan balik saat ini.";

    } catch (error) {
        console.error("Error getting pronunciation feedback:", error);
        return "Terjadi kesalahan saat menganalisis pelafalan Anda.";
    }
};