import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface VisibleElement {
  type: 'button' | 'input_field' | 'search_box' | 'menu' | 'icon' | 'link' | 'image' | 'error_message' | 'dialog_box' | 'text' | 'other';
  text: string;
  position: [number, number]; // [x, y] coordinates as integer percentages 0-100 of the screen
  description?: string;
}

export interface ScreenAnalysis {
  application: string;
  current_page: string;
  visible_elements: VisibleElement[];
  ocr_text: string;
}

export interface VisionMemoryItem {
  timestamp: Date;
  application: string;
  current_page: string;
  elementsCount: number;
}

// Bounding box / OCR Prompt instructing precise JSON coordinate extraction
const VISION_ANALYSIS_PROMPT = `
Analyze the provided computer screen screenshot in detail.
Identify the main active application (e.g., "Google Chrome", "Spotify", "Terminal") and the current section or page title (e.g., "YouTube Video Player", "Settings Dashboard").

Detect all interactive and non-interactive UI elements visible on the screen, specifically:
- Buttons
- Input fields
- Search boxes
- Menus
- Icons
- Links
- Images
- Error messages
- Dialog boxes

For EACH detected element:
1. Determine its type (e.g., 'button', 'input_field', 'search_box', 'menu', 'icon', 'link', 'image', 'error_message', 'dialog_box', 'text', 'other').
2. Read and extract its exact visible label text/name (OCR). If it is an icon or an image, provide a brief tag or text description (e.g., "Settings icon", "Profile image").
3. Estimate its precise layout position on the screen. The position must be specified as [x, y] relative coordinates in whole integer percentages (0 to 100) from the top-left corner of the screen.
   - [0, 0] is top-left, [100, 100] is bottom-right, [50, 50] is the exact center of the screen.
   - For positions, identify the coordinate of the center point of the UI element.

Also perform high-fidelity OCR to capture all prominent readable text from the screen and provide it in 'ocr_text'.

Return the results strictly adhering to the JSON schema. Be highly descriptive and accurate with coordinates.
`;

export async function analyzeScreen(base64Image: string): Promise<ScreenAnalysis> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: VISION_ANALYSIS_PROMPT,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["application", "current_page", "visible_elements", "ocr_text"],
          properties: {
            application: {
              type: Type.STRING,
              description: "The name of the main active application on the screen.",
            },
            current_page: {
              type: Type.STRING,
              description: "The current webpage, page title, or window title.",
            },
            ocr_text: {
              type: Type.STRING,
              description: "All accessible readable text from the full screen.",
            },
            visible_elements: {
              type: Type.ARRAY,
              description: "List of detected UI elements and buttons.",
              items: {
                type: Type.OBJECT,
                required: ["type", "text", "position"],
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "The type of UI element.",
                    enum: [
                      "button",
                      "input_field",
                      "search_box",
                      "menu",
                      "icon",
                      "link",
                      "image",
                      "error_message",
                      "dialog_box",
                      "text",
                      "other",
                    ],
                  },
                  text: {
                    type: Type.STRING,
                    description: "The button label, icon name, links text, or image label.",
                  },
                  position: {
                    type: Type.ARRAY,
                    description: "[x, y] coordinates from 0 to 100 where [0,0] is top-left and [100,100] is bottom-right.",
                    items: {
                      type: Type.INTEGER,
                    },
                  },
                  description: {
                    type: Type.STRING,
                    description: "Optional description explaining what this element does or its style (e.g. 'Blue primary button').",
                  },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    // Ensure format is correct
    if (!parsed.visible_elements) parsed.visible_elements = [];
    if (!parsed.ocr_text) parsed.ocr_text = "";
    return parsed as ScreenAnalysis;
  } catch (error) {
    console.error("Screen Vision API Error:", error);
    throw error;
  }
}

export async function askAboutScreen(
  base64Image: string,
  question: string,
  chatHistory: { role: 'user' | 'model', text: string }[] = []
): Promise<string> {
  try {
    const contents: any[] = chatHistory.map(item => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.text }]
    }));

    // Add current frame and the question to the contents
    contents.push({
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: `Question about this screenshot: ${question}\n\nProvide a precise, direct, and intelligent response without unnecessary preambles.`
        }
      ]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: "You are JARVIS Screen Vision. You help the user understand and interact with their screenshot. Answer questions directly, keeping the response clear, accurate, and short."
      }
    });

    return response.text || "No response received.";
  } catch (error) {
    console.error("Screen Q&A error:", error);
    throw error;
  }
}
