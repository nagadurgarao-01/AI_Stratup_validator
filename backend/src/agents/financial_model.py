"""Financial Model Agent — TAM/SAM/SOM calculation and Viability Score."""
import json
import os
from google import genai
from google.genai import types
from src.tools.calculator_tool import (
    calculate_viability_score,
    calculate_market_size,
    get_viability_label,
    ViabilityInputs,
    MarketSizeInputs,
)

FINANCIAL_SYSTEM_PROMPT = """You are a Financial Analysis Agent specializing in startup financial modeling.

Estimate realistic parameters based on market research provided.
Return ONLY valid JSON with this schema:
  "market_viability": 75,
  "competition_level": "Medium",
  "revenue_strength": 70,
  "technical_feasibility": "Moderate",
  "cost_level": "Medium",
  "feasibility_score": 65,
  "feasibility_reasoning": "string",
  "risk_factors": ["risk1", "risk2"],
  "revenue_model_suggestion": "string",
  "earning_potential_range": "string",
  "year1_projection": {"customers": 500, "revenue": 600000},
  "verdict": "Strong",
  "verdict_reasons": ["reason1", "reason2", "reason3"]
}"""


async def run_financial_model_agent(refined_hypothesis: str, market_data: dict, competitor_data: dict) -> dict:
    """Generate financial model from market and competitive research."""
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
    prompt = f"""
Based on this market research, extract financial modeling parameters:

**Hypothesis:** {refined_hypothesis}
- TAM Estimate: ${market_data.get('market_size', {}).get('tam_estimate', 0):,.0f}
- Total Potential Customers: {market_data.get('market_size', {}).get('total_potential_customers', 0):,}
- Average ARPU: ${market_data.get('market_size', {}).get('average_arpu', 0):,.0f}/year
- Market Growth Rate: {market_data.get('market_size', {}).get('growth_rate_percent', 0)}%
- Demand Signal: {market_data.get('overall_demand_signal', 50)}/100
- Competitive Gap Score: {competitor_data.get('competitive_gap_score', 50)}/100
- Number of Direct Competitors: {len(competitor_data.get('direct_competitors', []))}

Return ONLY valid JSON.
"""
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=FINANCIAL_SYSTEM_PROMPT,
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )
        llm_params = json.loads(response.text)
    except Exception as e:
        print(f"Financial model error: {e}")
        llm_params = {
            "market_viability": 60,
            "revenue_strength": 60,
            "technical_feasibility": "Moderate",
            "cost_level": "Medium",
            "feasibility_score": 60,
            "feasibility_reasoning": "Moderate technical complexity",
            "risk_factors": ["Market adoption", "Execution risk"],
            "revenue_model_suggestion": "SaaS",
            "earning_potential_range": "$100k - $500k ARR",
            "year1_projection": {"customers": 500, "revenue": 600000},
            "verdict": "Moderate",
            "verdict_reasons": ["Growing market", "Valid customer pain", "Strong competition"],
            "overall_score": 60,
        }
    
    market_inputs: MarketSizeInputs = {
        "total_potential_customers": market_data.get("market_size", {}).get("total_potential_customers", 100000),
        "average_annual_revenue_per_user": market_data.get("market_size", {}).get("average_arpu", 1200),
        "market_penetration_rate": llm_params.get("market_penetration_rate", 0.01),
        "obtainable_fraction": llm_params.get("obtainable_fraction", 0.1),
    }
    market_metrics = calculate_market_size(market_inputs)
    
    viability_inputs: ViabilityInputs = {
        "market_viability": llm_params.get("market_viability", 50),
        "financial_strength": llm_params.get("revenue_strength", 50),
        "feasibility": llm_params.get("feasibility_score", 50),
        "competitive_gap": competitor_data.get("competitive_gap_score", 50),
        "sdg_alignment": market_data.get("sdg_score", 50),
    }
    viability_score = calculate_viability_score(viability_inputs)
    label, color = get_viability_label(viability_score)
    
    return {
        "market_metrics": market_metrics,
        "viability_score": viability_score,
        "viability_label": label,
        "viability_color": color,
        "llm_financial_model": llm_params,
        "score_breakdown": {
            "market_viability": llm_params.get("market_viability", 50),
            "competition_level": llm_params.get("competition_level", "Medium"),
            "audience_clarity": llm_params.get("audience_clarity", 50),
            "revenue_strength": llm_params.get("revenue_strength", 50),
            "sdg_impact": market_data.get("sdg_score", 50), # Corrected later in orchestrator
        },
    }
