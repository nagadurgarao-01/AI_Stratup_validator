"""SDG Agent — analyzes startup ideas for UN Sustainable Development Goal alignment."""
import json
import os
from google import genai
from google.genai import types

SDG_SYSTEM_PROMPT = """You are a Sustainability Expert specializing in UN Sustainable Development Goals (SDGs).
Your job is to identify which SDGs a startup idea aligns with and calculate an impact score.

Focus on:
- SDG 8: Decent Work and Economic Growth
- SDG 9: Industry, Innovation, and Infrastructure
(But also identify any other relevant SDGs 1-17)

Return ONLY valid JSON with this schema:
  "explanation": "string explaining how the idea contributes to these goals",
  "ai_meaningful_usage": "How AI is used to solve the problem and drive impact"
}"""

async def run_sdg_agent(hypothesis: str) -> dict:
    """Analyze hypothesis for SDG impact."""
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
    prompt = f"Analyze the following startup idea for UN SDG impact: \"{hypothesis}\""
    
    try:
        response = client.models.generate_content(
            model="gemini-1.5-pro",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SDG_SYSTEM_PROMPT,
                temperature=0.2,
                response_mime_type="application/json",
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"SDG agent error: {e}")
        return {
            "score": 50,
            "sdg_numbers": [8, 9],
            "sdg_tags": ["Goal 8: Decent Work", "Goal 9: Industry & Innovation"],
            "explanation": "General alignment with economic growth and innovation goals.",
            "ai_meaningful_usage": "AI can be used to optimize resource allocation and provide personalized feedback."
        }
