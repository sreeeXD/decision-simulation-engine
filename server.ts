import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import OpenAI from "openai";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aiClient: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;
let groqClient: Groq | null = null;

function getGroq() {
  if (!groqClient) {
    let apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "gsk_...") {
      // Use the key provided by the user as primary fallback
      apiKey = "";
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

function getOpenAI() {
  if (!openaiClient) {
    let apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "sk-proj-...") {
      // Use the key provided by the user as primary fallback
      apiKey = "";
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function getAI() {
  if (!aiClient) {
    // Try multiple environment variable names commonly used in AI Studio
    let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      // Fallback to the hardcoded key if the environment variable is missing or is the placeholder
      apiKey = "";
    }
    
    if (!apiKey) {
      throw new Error(
        "Gemini API Key is missing. Please ensure the environment is correctly configured or provide a valid key in the Secrets panel."
      );
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function callAIWithRetry(params: any, maxRetries = 2) {
  let lastError: any;
  
  // Try Groq first as primary (as requested by user)
  try {
    const groq = getGroq();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Fast and reliable model on Groq
      messages: [{ role: "user", content: typeof params.contents === 'string' ? params.contents : JSON.stringify(params.contents) }],
      response_format: params.config?.responseMimeType === "application/json" ? { type: "json_object" } : undefined,
    }, {
      timeout: 5000, // 5s timeout for fast fallback
    });
    
    return {
      text: response.choices[0].message.content || "",
    };
  } catch (groqError: any) {
    const isQuotaError = groqError.status === 429 || (groqError.message && groqError.message.includes("quota"));
    if (isQuotaError) {
      console.warn("Groq quota exceeded or rate limited, switching to OpenAI.");
    } else {
      console.error("Groq failed or timed out, falling back to OpenAI:", groqError.message);
    }
    lastError = groqError;
  }
  
  // Try OpenAI as secondary fallback
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and reliable
      messages: [{ role: "user", content: typeof params.contents === 'string' ? params.contents : JSON.stringify(params.contents) }],
      response_format: params.config?.responseMimeType === "application/json" ? { type: "json_object" } : undefined,
    }, {
      timeout: 5000, // 5s timeout for fast fallback
    });
    
    return {
      text: response.choices[0].message.content || "",
    };
  } catch (openaiError: any) {
    const isQuotaError = openaiError.status === 429 || (openaiError.message && openaiError.message.includes("quota"));
    if (isQuotaError) {
      console.warn("OpenAI quota exceeded, switching to Gemini fallback.");
    } else {
      console.error("OpenAI failed or timed out, falling back to Gemini:", openaiError.message);
    }
    lastError = openaiError;
  }

  // Fallback to Gemini
  const ai = getAI();
  const modelsToTry = [params.model, "gemini-3.1-flash-lite-preview", "gemini-flash-latest"];
  
  for (const modelName of modelsToTry) {
    if (!modelName) continue;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model: modelName
        });
        return response;
      } catch (error: any) {
        lastError = error;
        
        // Extract error details for better detection
        const errorMessage = error.message || "";
        const errorStatus = error.status || (error.response ? error.response.status : null);
        const errorBody = error.response ? JSON.stringify(error.response) : "";
        
        const isRetryable = 
          errorStatus === 503 || 
          errorStatus === 429 || 
          errorMessage.includes("503") || 
          errorMessage.includes("429") || 
          errorMessage.includes("high demand") ||
          errorMessage.includes("UNAVAILABLE") ||
          errorBody.includes("503") ||
          errorBody.includes("high demand");

        if (isRetryable && i < maxRetries - 1) {
          // Faster backoff for fallback: 500ms, 1s
          const delay = (i + 1) * 500 + Math.random() * 500;
          console.log(`Gemini (${modelName}) busy or rate limited (${errorStatus}). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If not retryable or max retries reached for THIS model, break to try NEXT model
        console.warn(`Gemini model ${modelName} failed with error: ${errorMessage} (Status: ${errorStatus}). Trying next model...`);
        break; 
      }
    }
  }
  
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/generate-simulation", async (req, res) => {
    try {
      const { startupInfo } = req.body;
      const ai = getAI();
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        Act as a startup mentor and simulation engine. 
        Based on the following startup information, generate a dynamic number of key decision points (between 3 to 6) for a simulation journey.
        The number of decisions should depend on the complexity of the problem statement and the stage.
        
        Startup Info:
        - Idea: ${startupInfo.idea}
        - Stage: ${startupInfo.stage}
        - Target Users: ${startupInfo.targetUsers}
        - Budget: ${startupInfo.budget}
        - Goals: ${startupInfo.goals}
        
        POLICY INTEGRATION (CRITICAL):
        - Consider relevant government schemes (e.g., Startup India, PMFME, MSME subsidies, etc.) while generating decisions.
        - Integrate them naturally into the scenarios and options.
        - Government schemes should subtly influence risk reduction, financial scores, and trust.
        
        Return a JSON object with the following structure:
        {
          "decisionPoints": [
            {
              "id": "string",
              "title": "string",
              "scenario": "string",
              "options": [
                { "id": "string", "text": "string", "description": "string" }
              ]
            }
          ]
        }
        
        Ensure the decisions are realistic and highly relevant to the ${startupInfo.stage} stage.
        Each decision should have 3 distinct options.
      `;

      const response = await callAIWithRetry({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        },
      });

      const result = JSON.parse(response.text);
      if (!result.decisionPoints || !Array.isArray(result.decisionPoints)) {
        throw new Error("Invalid response format from AI: missing decisionPoints");
      }
      res.json(result);
    } catch (error) {
      console.error("Error generating simulation:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate simulation" });
    }
  });

  app.post("/api/simulate-outcome", async (req, res) => {
    try {
      const { startupInfo, decision, selectedOption, isCustom } = req.body;
      const ai = getAI();
      const model = "gemini-3-flash-preview";

      const prompt = `
        Act as a startup simulation engine. 
        A founder made a decision in a simulation. 
        ${isCustom ? "NOTE: The founder provided a CUSTOM out-of-the-box idea." : ""}
        
        Startup Info:
        - Idea: ${startupInfo.idea}
        - Stage: ${startupInfo.stage}
        
        Decision: ${decision.title}
        Scenario: ${decision.scenario}
        Selected Option: ${selectedOption.text} ${selectedOption.description ? `(${selectedOption.description})` : ""}
        
        POLICY INTEGRATION (CRITICAL):
        - Consider relevant government schemes (e.g., Startup India, PMFME, MSME subsidies, etc.) in the outcome.
        - Integrate them naturally within stakeholder reactions (e.g., "eligible for Startup India benefits") and explanations (e.g., "can reduce cost through subsidy").
        - Government schemes should subtly influence: reduce risk, improve financial score, increase trust.
        - If a useful scheme is not used, mention it as a missed opportunity in the insight.
        
        Simulate the outcome. Identify 3-4 relevant stakeholders (e.g., customers, investors, team, etc.) and their reactions.
        Update metrics (Impact, Financials, Risk, Trust) on a scale of -20 to +20 for this specific decision.
        Provide an AI insight and a better alternative.
        
        Return a JSON object:
        {
          "stakeholders": [
            { "name": "string", "role": "string", "reaction": "positive|negative|neutral", "comment": "string" }
          ],
          "metricsDelta": { "impact": number, "financials": number, "risk": number, "trust": number },
          "insight": "string",
          "alternative": "string"
        }
      `;

      const response = await callAIWithRetry({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        },
      });

      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error("Error simulating outcome:", error);
      res.status(500).json({ error: "Failed to simulate outcome" });
    }
  });

  app.post("/api/simulate-alternatives", async (req, res) => {
    try {
      const { startupInfo, decision } = req.body;
      const ai = getAI();
      const model = "gemini-3-flash-preview";

      const prompt = `
        Act as a startup simulation engine. 
        The founder wants to see "What If" analysis for the options they DID NOT choose.
        
        Startup Info:
        - Idea: ${startupInfo.idea}
        - Stage: ${startupInfo.stage}
        
        Decision: ${decision.title}
        Scenario: ${decision.scenario}
        All Options: ${JSON.stringify(decision.options)}
        
        For each option in the list, simulate a BRIEF outcome.
        Focus on the metrics delta and a one-sentence summary of the impact.
        
        Return a JSON object:
        {
          "alternatives": [
            {
              "optionId": "string",
              "summary": "string",
              "metricsDelta": { "impact": number, "financials": number, "risk": number, "trust": number }
            }
          ]
        }
      `;

      const response = await callAIWithRetry({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        },
      });

      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error("Error simulating alternatives:", error);
      res.status(500).json({ error: "Failed to simulate alternatives" });
    }
  });

  app.post("/api/generate-report", async (req, res) => {
    try {
      const { startupInfo, history, finalMetrics } = req.body;
      const ai = getAI();
      const model = "gemini-3-flash-preview";

      const prompt = `
        Act as a startup mentor. The founder has completed the simulation.
        
        Startup Info:
        - Idea: ${startupInfo.idea}
        - Stage: ${startupInfo.stage}
        
        Simulation History:
        ${JSON.stringify(history)}
        
        Final Metrics:
        ${JSON.stringify(finalMetrics)}
        
        POLICY INTEGRATION (CRITICAL):
        - Consider relevant government schemes (e.g., Startup India, PMFME, MSME subsidies, etc.) in the report.
        - Integrate them naturally within the summary and roadmap steps (e.g., "apply for PMFME scheme").
        - If a useful scheme was not used during the simulation, mention it as a missed opportunity in the summary.
        
        Generate a comprehensive final report.
        Return a JSON object:
        {
          "summary": "string (markdown)",
          "strengths": ["string"],
          "weaknesses": ["string"],
          "observations": ["string"],
          "dashboard": {
            "impact": number (0-100),
            "financials": number (0-100),
            "risk": number (0-100),
            "readiness": number (0-100)
          },
          "roadmap": [
            { "step": "string", "action": "string" }
          ]
        }
      `;

      const response = await callAIWithRetry({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        },
      });

      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
