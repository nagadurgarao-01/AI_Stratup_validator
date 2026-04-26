"""Pivot Agent — generates alternative business directions for low-scoring ideas."""
import json
import os
from google import genai
from google.genai import types

PIVOT_SYSTEM_PROMPT = """You are a Strategic Pivot Specialist. Your job is to take a low-scoring startup idea and suggest 3 distinct pivots.

Each pivot must include:
- Pivot Title
- 1-paragraph description (2-3 sentences)
- Target Audience
- Why it's better than the original
- Linked UN SDG (number)
- Estimated Viability Score (0-100)

Return ONLY valid JSON array of 3 objects:
[{
  "pivotTitle": "string",
  "description": "string",
  "targetAudience": "string",
  "whyBetter": "string",
  "sdgAlignment": [number],
  "estimatedScore": number
}]"""

async def run_pivot_agent(hypothesis: str, scores: dict) -> list[dict]:
    """Generate 3 pivot suggestions."""
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
    prompt = f"""
    Generate 3 distinct pivot suggestions for the following low-scoring startup idea: "{hypothesis}"
    Original scores: {json.dumps(scores)}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-1.5-pro",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=PIVOT_SYSTEM_PROMPT,
                temperature=0.4,
                response_mime_type="application/json",
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Pivot agent error: {e}")
        return [
            {
                "pivotTitle": "B2B Efficiency Tool",
                "description": "Focus on the enterprise segment to solve specific administrative overhead.",
                "targetAudience": "Corporate Managers",
                "whyBetter": "Higher willingness to pay and clearer ROI.",
                "sdgAlignment": [8],
                "estimatedScore": 75
            },
            {
                "pivotTitle": "D2C Sustainable Marketplace",
                "description": "Direct-to-consumer approach focusing on ethical and sustainable products.",
                "targetAudience": "Conscious Consumers",
                "whyBetter": "Leverages growing sustainability trends.",
                "sdgAlignment": [12],
                "estimatedScore": 70
            },
            {
                "pivotTitle": "Mobile-First Education Platform",
                "description": "Bite-sized learning for underserved communities.",
                "targetAudience": "Students in Tier 2/3 cities",
                "whyBetter": "Scalable and addresses a high-impact gap.",
                "sdgAlignment": [4],
                "estimatedScore": 80
            }
        ]
