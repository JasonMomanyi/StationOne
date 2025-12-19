import { GoogleGenAI, GenerativeModel } from "@google/genai";
import { AI_SYSTEM_INSTRUCTION } from '../constants';
import { TraverseResult } from "../types";

// Initialize Gemini Client
// We use a factory function to create the client when needed to ensure API key presence
const createClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key missing");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeSurveyData = async (
  traverseData: TraverseResult, 
  userNotes: string = ""
): Promise<string> => {
  const ai = createClient();
  if (!ai) return "AI Service Unavailable: Missing API Key.";

  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the following survey traverse results:
    
    Total Length: ${traverseData.totalLength.toFixed(3)} m
    Misclosure Distance: ${traverseData.misclosureDist.toFixed(4)} m
    Misclosure Azimuth: ${traverseData.misclosureAzimuth.toFixed(1)} degrees
    Relative Precision: 1:${Math.round(traverseData.precision)}
    Closing Error dE: ${traverseData.deltaE.toFixed(4)}
    Closing Error dN: ${traverseData.deltaN.toFixed(4)}
    
    User Field Notes: "${userNotes}"

    Please provide:
    1. An assessment of the accuracy based on standard engineering survey classes (e.g., 1st order to 4th order).
    2. Potential causes for error if precision is low (< 1:5000).
    3. Recommendations for adjustment or re-observation.
    4. A concise "Field Decision": ACCEPT or REJECT.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: AI_SYSTEM_INSTRUCTION,
      }
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error generating analysis. Please check connection and API limits.";
  }
};

export const chatWithFieldAssistant = async (
  history: { role: string; text: string }[],
  newMessage: string
): Promise<string> => {
  const ai = createClient();
  if (!ai) return "AI Service Unavailable.";

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: AI_SYSTEM_INSTRUCTION,
      },
      history: history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.text }]
      }))
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "No response.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "I'm having trouble connecting to the survey database right now.";
  }
};
