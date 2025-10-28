import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { EmailClassification } from '../types';

/**
 * Predefined list of recipient email addresses.
 */
export const RECIPIENTS = ['support@example.com', 'sales@example.com', 'marketing@example.com', 'billing@example.com', 'info@example.com'];

/**
 * Service for interacting with the Gemini API to classify emails.
 */
export const geminiService = {
  /**
   * Classifies an email using the Gemini API.
   * @param emailContent The raw content of the email to classify.
   * @returns A promise that resolves to the classified email details.
   * @throws An error if the API call fails or the response cannot be parsed.
   */
  async classifyEmail(emailContent: string): Promise<EmailClassification> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `Classify the following email into a category, assign a priority, suggest a recipient, and provide a brief summary.

    Categories: Support, Sales, Marketing, Billing, General Inquiry
    Priorities: High, Medium, Low
    Recipients: ${RECIPIENTS.join(', ')}

    Email content:
    \`\`\`
    ${emailContent}
    \`\`\`

    Provide the output in JSON format.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                enum: ['Support', 'Sales', 'Marketing', 'Billing', 'General Inquiry'],
                description: 'The classified category of the email.',
              },
              priority: {
                type: Type.STRING,
                enum: ['High', 'Medium', 'Low'],
                description: 'The priority of the email.',
              },
              suggestedRecipient: {
                type: Type.STRING,
                enum: RECIPIENTS, // Use the exported RECIPIENTS constant here
                description: 'The suggested recipient email address.',
              },
              summary: {
                type: Type.STRING,
                description: 'A brief summary of the email content.',
              },
            },
            required: ['category', 'priority', 'suggestedRecipient', 'summary'],
            propertyOrdering: ['category', 'priority', 'suggestedRecipient', 'summary'],
          },
        },
      });

      const jsonStr = response.text.trim();
      // Gemini might wrap the JSON in markdown code block, so we need to extract it.
      const cleanedJsonStr = jsonStr.startsWith('```json') && jsonStr.endsWith('```')
        ? jsonStr.substring(7, jsonStr.length - 3).trim()
        : jsonStr;
        
      const classification: EmailClassification = JSON.parse(cleanedJsonStr);
      return classification;

    } catch (error) {
      console.error("Error classifying email:", error);
      throw new Error(`Failed to classify email: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  /**
   * Generates a draft email response based on the original email content and its classification.
   * @param emailContent The raw content of the original email.
   * @param classification The classification details of the email.
   * @returns A promise that resolves to the generated response draft as a string.
   */
  async generateResponseDraft(emailContent: string, classification: EmailClassification): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `Draft a polite and concise email response for the following original email, considering its classification and suggested recipient.

    Original email content:
    \`\`\`
    ${emailContent}
    \`\`\`

    Classification details:
    Category: ${classification.category}
    Priority: ${classification.priority}
    Suggested Recipient: ${classification.suggestedRecipient}
    Summary: ${classification.summary}

    Draft the response from the perspective of an appropriate agent (e.g., support, sales) based on the category. Ensure it acknowledges the sender's query and suggests next steps or provides relevant information.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
      });

      return response.text;
    } catch (error) {
      console.error("Error generating response draft:", error);
      throw new Error(`Failed to generate response draft: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  /**
   * Extracts actionable items from the given email content.
   * @param emailContent The raw content of the email.
   * @returns A promise that resolves to an array of strings, each representing an action item.
   */
  async extractActionItems(emailContent: string): Promise<string[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `From the following email content, identify and list all distinct actionable items. Return them as a JSON array of strings.

    Email content:
    \`\`\`
    ${emailContent}
    \`\`\`

    Example output:
    ["Action item 1", "Action item 2"]`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },
        },
      });

      const jsonStr = response.text.trim();
      const cleanedJsonStr = jsonStr.startsWith('```json') && jsonStr.endsWith('```')
        ? jsonStr.substring(7, jsonStr.length - 3).trim()
        : jsonStr;

      const actionItems: string[] = JSON.parse(cleanedJsonStr);
      return actionItems;
    } catch (error) {
      console.error("Error extracting action items:", error);
      throw new Error(`Failed to extract action items: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};