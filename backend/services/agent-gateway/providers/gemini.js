const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiProvider {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Using gemini-2.5-flash for speed and efficiency
    this.modelName = 'gemini-2.5-flash';
  }

  async chat({ system, message, temperature = 0.5 }) {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: system,
      });

      const generationConfig = {
        temperature,
        maxOutputTokens: 8192, // Higher limit for 1.5 models
      };

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig,
      });

      const response = await result.response;
      const content = response.text();
      
      const usage = response.usageMetadata;
      const tokensUsed = (usage?.promptTokenCount || 0) + (usage?.candidatesTokenCount || 0);

      return { content, tokensUsed };
    } catch (error) {
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }
}

module.exports = GeminiProvider;
