
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Recipe, Language, Continent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const getLanguageName = (lang: Language) => {
  const names = { pt: 'Português do Brasil', en: 'English', es: 'Español', fr: 'Français' };
  return names[lang];
};

export const generateRecipe = async (
  ingredientInput: string, 
  lang: Language = 'pt', 
  continent: Continent = 'Global',
  correctionFeedback?: string
): Promise<Recipe> => {
  const model = ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Você é um Historiador Gastronômico e Master Chef. 
    Analise o input: "${ingredientInput}". 
    
    ${correctionFeedback ? `AVISO DE CORREÇÃO DO PESQUISADOR: "${correctionFeedback}". 
    Você deve aprender com este feedback e ajustar a receita para ser MAIS fiel à realidade cultural descrita pelo pesquisador.` : ''}
    
    TAREFA:
    1. Se o input for um nome de prato, identifique o PAÍS de origem exato.
    2. Se o país for identificado, ignore o seletor genérico de continente e use a cultura específica.
    3. Crie uma receita 100% autêntica.
    
    Idioma de Resposta: ${getLanguageName(lang)}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
          prepTime: { type: Type.STRING },
          servings: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          origin: { type: Type.STRING },
          continentDetected: { type: Type.STRING },
          isRefined: { type: Type.BOOLEAN, description: "True se a receita foi ajustada com feedback do pesquisador" },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING },
                quantity: { type: Type.STRING }
              },
              required: ['item', 'quantity']
            }
          },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                instruction: { type: Type.STRING },
                tip: { type: Type.STRING }
              },
              required: ['title', 'instruction']
            }
          }
        },
        required: ['title', 'description', 'ingredients', 'steps', 'prepTime', 'difficulty', 'origin', 'continentDetected']
      }
    }
  });

  const response = await model;
  const recipeData = JSON.parse(response.text || '{}');
  return { ...recipeData, id: Math.random().toString(36).substr(2, 9) };
};

export const performGastronomyResearch = async (query: string, lang: Language): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Realize uma pesquisa gastronômica profunda sobre: ${query}. 
    Inclua detalhes sobre países específicos (ex: Cabo Verde, São Tomé, Guiné-Bissau).
    Foque em história, técnicas e simbolismo cultural. 
    Idioma: ${getLanguageName(lang)}. 
    Use formatação Markdown elegante.`,
  });
  return response.text;
};

export const generateRecipeImage = async (recipeTitle: string): Promise<string> => {
  const model = ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `Authentic food photography of ${recipeTitle}. Traditional presentation, high-end culinary lighting.` }
      ]
    },
    config: {
      imageConfig: { aspectRatio: "16:9" }
    }
  });

  const response = await model;
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return 'https://picsum.photos/800/450';
};

export const generateSpeech = async (text: string, lang: Language): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: lang === 'en' ? 'Puck' : 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    return undefined;
  }
};
