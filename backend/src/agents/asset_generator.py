"""Asset Generator Agent — Business plan, brand kit, and marketing assets."""
import json
import os
from google import genai
from google.genai import types

BRAND_ARCHETYPES = {
    "The Hero": {"colors": ["#1E3A8A", "#EF4444", "#F8FAFC"], "vibe": "Bold, ambitious, competitive"},
    "The Creator": {"colors": ["#7C3AED", "#F59E0B", "#FAFAF9"], "vibe": "Innovative, expressive, artistic"},
    "The Sage": {"colors": ["#1E40AF", "#64748B", "#F0F9FF"], "vibe": "Knowledgeable, trusted, analytical"},
    "The Explorer": {"colors": ["#059669", "#F97316", "#ECFDF5"], "vibe": "Adventurous, authentic, freedom"},
    "The Caregiver": {"colors": ["#0EA5E9", "#10B981", "#F0FDFA"], "vibe": "Nurturing, helpful, generous"},
    "The Ruler": {"colors": ["#1C1917", "#D97706", "#FAFAF9"], "vibe": "Premium, authoritative, exclusive"},
    "The Rebel": {"colors": ["#DC2626", "#1C1917", "#FEF2F2"], "vibe": "Disruptive, bold, unconventional"},
    "The Magician": {"colors": ["#7C3AED", "#EC4899", "#0A0F1E"], "vibe": "Transformative, visionary, mystical"},
    "The Everyman": {"colors": ["#16A34A", "#6B7280", "#F9FAFB"], "vibe": "Relatable, down-to-earth, affordable"},
    "The Innocent": {"colors": ["#FBBF24", "#86EFAC", "#FFFBEB"], "vibe": "Optimistic, simple, honest"},
    "The Lover": {"colors": ["#EC4899", "#F43F5E", "#FFF1F2"], "vibe": "Passionate, intimate, luxurious"},
    "The Jester": {"colors": ["#F59E0B", "#EF4444", "#FFFBEB"], "vibe": "Playful, fun, irreverent"},
}

ASSET_SYSTEM_PROMPT = """You are a Brand Strategy and Business Planning Agent.
Return ONLY valid JSON with this schema:
{
  "brand_identity": {
    "archetype": "The Creator",
    "archetype_reasoning": "string",
    "brand_name_suggestions": ["Name1", "Name2", "Name3", "Name4", "Name5"],
    "tagline": "string",
    "brand_voice": "string",
    "typography": {"heading": "Cal Sans", "body": "Inter"}
  },
  "business_plan_outline": {
    "executive_summary": "string",
    "problem_statement": "string",
    "solution": "string",
    "value_proposition": "string",
    "target_market": "string",
    "business_model": "string",
    "go_to_market_strategy": {
      "phase1": "First 90 days",
      "phase2": "Months 4-12",
      "phase3": "Year 2+"
    },
    "revenue_streams": ["stream1", "stream2"],
    "cost_structure": ["cost1", "cost2"],
    "key_metrics": ["metric1", "metric2", "metric3"],
    "competitive_advantage": "string",
    "team_requirements": ["CTO", "Head of Sales"],
    "funding_requirements": {
      "seed_amount": "$500K",
      "use_of_funds": ["40% Engineering", "30% Marketing", "30% Operations"]
    },
    "risk_matrix": [
      {"risk": "string", "probability": "medium", "mitigation": "string"}
    ],
    "full_plan_sections": [
      "Executive Summary",
      "Customer Discovery",
      "Product Strategy",
      "Go-to-Market",
      "Financial Projections",
      "Operational Plan",
      "Hiring Plan",
      "Risk Management",
      "Fundraising Narrative"
    ]
  },
  "marketing_channels": [
    {"channel": "Content Marketing", "strategy": "string", "expected_cac": "$150"}
  ],
  "ad_creatives": [
    {
      "platform": "Meta",
      "audience": "string",
      "headline": "string",
      "body": "string",
      "cta": "string",
      "visual_concept": "string"
    },
    {
      "platform": "LinkedIn",
      "audience": "string",
      "headline": "string",
      "body": "string",
      "cta": "string",
      "visual_concept": "string"
    },
    {
      "platform": "Google Search",
      "audience": "string",
      "headline": "string",
      "body": "string",
      "cta": "string",
      "visual_concept": "string"
    }
  ],
  "swot_analysis": {
    "strengths": ["s1", "s2"],
    "weaknesses": ["w1", "w2"],
    "opportunities": ["o1", "o2"],
    "threats": ["t1", "t2"]
  },
  "pitch_helper": {
    "elevator_pitch": "string",
    "project_title": "string"
  },
  "improvement_suggestions": {
    "innovation": "string",
    "niche_targeting": "string",
    "feature_enhancements": ["f1", "f2"]
  }
}"""


async def run_asset_generator_agent(refined_hypothesis: str, market_data: dict, competitor_data: dict, financial_data: dict) -> dict:
    """Generate business plan and brand identity assets."""
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    market_size = financial_data.get("market_metrics", {})
    
    prompt = f"""
Generate a comprehensive business plan and brand identity for this startup:

**Validated Hypothesis:** {refined_hypothesis}
- TAM: {market_size.get('tam_formatted', 'Unknown')}
- SAM: {market_size.get('sam_formatted', 'Unknown')}
- SOM Target: {market_size.get('som_formatted', 'Unknown')}
- Viability Score: {financial_data.get('viability_score', 0)}/100 ({financial_data.get('viability_label', '')})
- Blue Ocean Creates: {json.dumps(competitor_data.get('blue_ocean_strategy', {}).get('create', []))}
- Positioning: {competitor_data.get('positioning_recommendation', '')}
- Business Model: {financial_data.get('llm_financial_model', {}).get('recommended_business_model', 'SaaS')}

Choose the most fitting Jungian archetype. Return ONLY valid JSON.
"""
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=ASSET_SYSTEM_PROMPT,
                temperature=0.7,
                response_mime_type="application/json",
            ),
        )
        result = json.loads(response.text)
    except Exception as e:
        print(f"Asset generator error: {e}")
        result = {
            "brand_identity": {
                "archetype": "The Creator",
                "archetype_reasoning": "Innovation-driven positioning fits this market",
                "brand_name_suggestions": ["LaunchPad", "VenturePulse", "IdeaForge", "StartWise", "PivotPoint"],
                "tagline": "Validate. Build. Launch.",
                "brand_voice": "Confident, data-driven, empowering",
                "typography": {"heading": "Cal Sans", "body": "Inter"},
            },
            "business_plan_outline": {
                "executive_summary": f"A validated startup addressing: {refined_hypothesis}",
                "value_proposition": "The fastest path from idea to investor-ready strategy",
                "business_model": financial_data.get('llm_financial_model', {}).get('recommended_business_model', 'SaaS'),
                "go_to_market_strategy": {
                    "phase1": "Direct outreach to early adopters in target segment",
                    "phase2": "Content marketing and partnership development",
                    "phase3": "Scale with paid acquisition and enterprise sales",
                },
                "revenue_streams": ["Monthly SaaS subscriptions", "Enterprise licenses", "Premium report exports"],
                "key_metrics": ["MRR growth", "Customer activation rate", "NPS score"],
                "risk_matrix": [{"risk": "Market adoption speed", "probability": "medium", "mitigation": "Focus on early adopter segment first"}],
                "full_plan_sections": [
                  "Executive Summary",
                  "Customer Discovery",
                  "Product Strategy",
                  "Go-to-Market",
                  "Financial Projections",
                  "Operational Plan",
                  "Hiring Plan",
                  "Risk Management",
                  "Fundraising Narrative",
                ],
            },
              "marketing_channels": [
                {"channel": "Content Marketing", "strategy": "Founder-led market education on startup validation", "expected_cac": "$90"},
                {"channel": "Performance Ads", "strategy": "Intent-keyword ads for startup idea validation", "expected_cac": "$140"},
                {"channel": "Partnerships", "strategy": "Accelerator and incubator referral channels", "expected_cac": "$60"},
              ],
              "ad_creatives": [
                {
                  "platform": "Meta",
                  "audience": "Early-stage founders and side-hustlers",
                  "headline": "Validate Your Startup Idea in 10 Minutes",
                  "body": "Replace weeks of guesswork with AI-backed market research, competitor gaps, and viability scoring.",
                  "cta": "Get My Validation Report",
                  "visual_concept": "Split-screen before/after: messy notes vs. polished investor-ready report",
                },
                {
                  "platform": "LinkedIn",
                  "audience": "B2B startup founders and product leaders",
                  "headline": "Investor-Ready Validation Before You Build",
                  "body": "Stress-test assumptions, size your market, and identify blue-ocean opportunities with autonomous AI agents.",
                  "cta": "Run Validation",
                  "visual_concept": "Professional dashboard with TAM/SAM/SOM and viability gauge",
                },
                {
                  "platform": "Google Search",
                  "audience": "Users searching startup idea validation tools",
                  "headline": "AI Startup Idea Validator",
                  "body": "Get market research, competitor intel, and financial modeling in minutes.",
                  "cta": "Start Free Validation",
                  "visual_concept": "Text-first search ad with proof points and speed claim",
                },
              ],
              "swot_analysis": {
                "strengths": ["Clear pain point", "Rising market demand"],
                "weaknesses": ["Low initial barrier to entry", "Limited early dataset"],
                "opportunities": ["Partnerships with accelerators", "Global expansion"],
                "threats": ["Big tech entry", "Changing regulations"]
              },
              "pitch_helper": {
                "elevator_pitch": "A revolutionary platform that empowers founders to validate hypotheses with real-time AI agents.",
                "project_title": "IdeaForge AI"
              },
              "improvement_suggestions": {
                "innovation": "Use reinforcement learning to improve validation accuracy over time.",
                "niche_targeting": "Focus exclusively on student housing startups in Tier 2 cities.",
                "feature_enhancements": ["One-click landing page generator", "Investor matching algorithm"]
              },
        }
    
    archetype = result.get("brand_identity", {}).get("archetype", "The Creator")
    archetype_data = BRAND_ARCHETYPES.get(archetype, BRAND_ARCHETYPES["The Creator"])
    if "brand_identity" not in result:
        result["brand_identity"] = {}
    result["brand_identity"]["color_palette"] = archetype_data["colors"]
    result["brand_identity"]["brand_vibe"] = archetype_data["vibe"]
    
    return result
