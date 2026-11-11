import { GoogleGenAI } from '@google/genai';

/**
 * Gemini API で今回の質問だけから回答を生成する（サーバー側のみ）。
 */
export async function generateAnswer(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が未設定です');
  }
  if (!model) {
    throw new Error('GEMINI_MODEL が未設定です');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 60_000,
      // attempts は初回を含む。1 = 自動再試行しない
      retryOptions: { attempts: 1 },
    },
  });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      maxOutputTokens: 1024,
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('AI回答が空でした');
  }
  return text;
}
