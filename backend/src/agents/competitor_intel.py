"""Competitor Intelligence Agent — SWOT analysis and Blue Ocean positioning."""
import json
import os
from google import genai
from google.genai import types

COMPETITOR_SYSTEM_PROMPT = """You are a Competitive Intelligence Agent specializing in startup competitive analysis.

Return ONLY valid JSON with this schema:
{
  "direct_competitors": [
    {
      "name": "CompanyName",
      "url": "https://example.com",
      "description": "string",
      "pricing": "$X/month",
      "strengths": ["strength1"],
      "weaknesses": ["weakness1"],
      "review_gaps": ["specific 3-star complaint"],
      "market_share_estimate": "~10%"
    }
  ],
  "indirect_competitors": [
    {
      "name": "string",
      "description": "string",
      "why_indirect": "string"
    }
  ],
  "gap_analysis": {
    "unmet_needs": ["unmet need 1"],
    "pain_points_not_addressed": ["pain point 1"],
    "feature_gaps": ["missing feature 1"]
  },
  "blue_ocean_strategy": {
    "eliminate": ["what to eliminate"],
    "reduce": ["what to reduce"],
    "raise": ["what to raise"],
    "create": ["what to create"]
  },
  "positioning_recommendation": "string",
  "uniqueness_score": 85,
  "market_saturation": "Medium",
  "innovation_explanation": "string explaining the unique angle or technology",
  "competitive_gap_score": 72
}"""


async def run_competitor_intel_agent(refined_hypothesis: str, market_data: dict) -> dict:
    """Analyze competitive landscape using Google Search grounding."""
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
    prompt = f"""
Conduct competitive intelligence research for this startup:

**Hypothesis:** {refined_hypothesis}

Research tasks:
1. Search for top competitors in this space
2. Find customer reviews and complaints (look for 2-3 star reviews on G2, Capterra, Trustpilot)
3. Identify what customers hate about existing solutions
4. Find the competitive gap — what's missing in the market
5. Build a Blue Ocean strategy based on gaps

Return ONLY valid JSON matching the schema in your system instructions.
Identify exactly 5 competitors (including a mix of Direct and Indirect).
For each, provide exactly 1 strength and 1 weakness.
"""
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=COMPETITOR_SYSTEM_PROMPT,
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.2,
            ),
        )
        
        text = response.text if hasattr(response, 'text') and response.text else ""
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
        else:
            result = _fallback_competitor_data()
    except Exception as e:
        print(f"Competitor intel error: {e}")
        result = _fallback_competitor_data()
    
    return result


def _fallback_competitor_data() -> dict:
    return {
        "direct_competitors": [
            {
                "name": "Existing Solution A",
                "url": "https://example.com",
                "description": "Market incumbent",
                "pricing": "$50/month",
                "strengths": ["Brand recognition", "Large customer base"],
                "weaknesses": ["Outdated UI", "Poor customer support"],
                "review_gaps": ["Too expensive for small teams", "Steep learning curve"],
                "market_share_estimate": "~30%"
            }
        ],
        "indirect_competitors": [],
        "gap_analysis": {
            "unmet_needs": ["Affordable pricing for SMBs", "Better mobile experience"],
            "pain_points_not_addressed": ["Real-time collaboration", "AI-assisted workflows"],
            "feature_gaps": ["Mobile-first design", "Freemium entry point"]
        },
        "blue_ocean_strategy": {
            "eliminate": ["Complex setup process", "Annual contracts"],
            "reduce": ["Feature bloat", "Onboarding friction"],
            "raise": ["Ease of use", "Customer support quality"],
            "create": ["AI-powered automation", "Usage-based pricing"]
        },
        "positioning_recommendation": "The affordable, AI-first alternative built for modern teams",
        "uniqueness_score": 70,
        "market_saturation": "Medium",
        "innovation_explanation": "Leveraging generative AI to automate workflows that were previously manual",
        "competitive_gap_score": 65,
    }
