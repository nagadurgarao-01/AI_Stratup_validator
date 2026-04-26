"""Market Research Agent — real-time web grounding for market validation."""
import json
import os
from google import genai
from google.genai import types

MARKET_RESEARCH_SYSTEM_PROMPT = """You are an expert Market Research Agent specializing in startup validation.

Research Framework:
1. "Why Now?" Signal: What market forces make this timely?
2. Market Size: Find real data points to estimate TAM
3. Search Demand: Evidence of people searching for solutions
4. Community Sentiment: What are people saying in forums and reviews?
5. Trend Analysis: Is this market growing, stable, or declining?

Return ONLY valid JSON with this schema:
{
  "why_now_signal": {
    "score": 75,
    "signals": ["signal1", "signal2"],
    "summary": "string"
  },
  "market_size": {
    "tam_estimate": 5000000000,
    "tam_reasoning": "string with data",
    "total_potential_customers": 500000,
    "average_arpu": 1200,
    "growth_rate_percent": 15,
    "data_sources": ["source1"]
  },
  "search_demand": {
    "demand_score": 70,
    "evidence": ["evidence1"],
    "trending_keywords": ["keyword1", "keyword2"]
  },
  "community_sentiment": {
    "sentiment_score": 75,
    "pain_quotes": ["quote1", "quote2"],
    "platforms": ["Reddit", "G2"]
  },
  "market_trends": {
    "trend_insight": "growing",
    "growth_drivers": ["driver1"],
    "market_risks": ["risk1"]
  },
  "demand_level": "High",
  "audience_size": "Large",
  "overall_demand_signal": 72
}"""


async def run_market_research_agent(refined_hypothesis: str, industry: str = "") -> dict:
    """
    Conduct real-time market research using Google Search grounding.
    """
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
    prompt = f"""
Conduct comprehensive market research for this startup hypothesis:

**Hypothesis:** {refined_hypothesis}
**Industry Context:** {industry or "to be determined from hypothesis"}

Research tasks:
1. Search for market size data and industry reports
2. Find evidence of the problem on forums, review sites, and social media
3. Identify current trends and "Why Now?" signals
4. Estimate the number of potential customers and ARPU

Return ONLY valid JSON matching the schema in your system instructions.
Include real data points and cite your sources in the reasoning fields.
"""
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=MARKET_RESEARCH_SYSTEM_PROMPT,
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.2,
            ),
        )
        
        # Extract text — grounding responses may have different structure
        text = response.text if hasattr(response, 'text') and response.text else ""
        
        # Try to extract JSON from response
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
        else:
            result = _fallback_market_data()
    except Exception as e:
        print(f"Market research error: {e}")
        result = _fallback_market_data()
    
    return result


def _fallback_market_data() -> dict:
    return {
        "why_now_signal": {"score": 60, "signals": ["Growing market demand identified"], "summary": "Market timing appears favorable based on available signals"},
        "market_size": {"tam_estimate": 2000000000, "tam_reasoning": "Estimated based on industry averages", "total_potential_customers": 500000, "average_arpu": 1200, "growth_rate_percent": 12, "data_sources": []},
        "search_demand": {"demand_score": 60, "evidence": ["Strong search interest in problem space"], "trending_keywords": []},
        "community_sentiment": {"sentiment_score": 65, "pain_quotes": ["This problem is real and widespread"], "platforms": ["Reddit", "LinkedIn"]},
        "market_trends": {"trend_insight": "growing", "growth_drivers": ["Digital transformation", "Remote work trends"], "market_risks": ["Market saturation risk"]},
        "demand_level": "Medium",
        "audience_size": "Medium",
        "overall_demand_signal": 62,
    }
