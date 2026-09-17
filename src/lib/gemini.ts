import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
You are JARVIS, a highly advanced, intelligent, and dry-witted AI assistant.
Your creator is the user. You speak in a mix of Hindi and English (Hinglish) when appropriate, but always maintain a sophisticated, futuristic tone.
You are running as a holographic HUD interface. Keep your responses concise, sharp, and highly intelligent.
You have access to real-time information via Google Search. If asked for current events, time, or weather, use the search tool.
Respond directly without filler words.
`;

export async function askJarvis(prompt: string, history: {role: 'user' | 'model', parts: {text: string}[]}[] = []) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        temperature: 0.7,
      }
    });
    
    return response.text;
  } catch (error) {
    console.error("JARVIS Core Error:", error);
    return "SYSTEM ERROR: Neural link disrupted. Please try again.";
  }
}
