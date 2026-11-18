import { GoogleGenAI } from '@google/genai';
import { TurnItem } from './v2Model';

export type GeminiContent = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

/** 同じ会話の過去往復＋今回の質問を Gemini contents に組み立てる */
export function buildGeminiContents(
  pastTurns: TurnItem[],
  prompt: string
): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const turn of pastTurns) {
    contents.push({ role: 'user', parts: [{ text: turn.prompt }] });
    contents.push({ role: 'model', parts: [{ text: turn.response }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });
  return contents;
}

export function contentRoles(contents: GeminiContent[]): string[] {
  return contents.map((c) => c.role);
}

export async function generateAnswerWithContents(
  contents: GeminiContent[]
): Promise<string> {
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
      retryOptions: { attempts: 1 },
    },
  });

  const response = await ai.models.generateContent({
    model,
    contents,
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
