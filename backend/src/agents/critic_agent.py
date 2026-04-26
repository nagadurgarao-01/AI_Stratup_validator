"""Critic Agent — challenges startup hypotheses and forces problem-first thinking."""
import json
import os
from google import genai
from google.genai import types

CRITIC_SYSTEM_PROMPT = """You are a rigorous Startup Critic Agent. Your job is to stress-test startup hypotheses before any research begins.

You are NOT a cheerleader. You are a seasoned venture capitalist.
Your job is to:
1. Validate the hypothesis is properly structured as: "Specific [target customer] struggles with [problem] because [root cause]"
2. Challenge assumptions ruthlessly — especially solution-first thinking
3. Identify the top 3 critical risks or logical flaws
4. Refine the hypothesis to be sharper and more testable

Return ONLY valid JSON with this schema:
  "original_hypothesis": "string",
  "extraction": {
    "target_users": "string",
    "core_problem": "string",
    "root_cause": "string",
    "impact": "string (quantified if possible)"
  },
  "clarity_score": 8,
  "improvement_suggestions": "How to make the idea clearer or more specific",
  "is_problem_first": true,
  "refined_hypothesis": "string — sharper, more specific version",
  "assumptions_challenged": ["assumption 1", "assumption 2", "assumption 3"],
  "critical_risks": [
    {"risk": "string", "severity": "high", "mitigation": "string"}
  ],
  "readiness_to_research": true
}"""


async def run_critic_agent(raw_hypothesis: str) -> dict:
    """Challenge the startup hypothesis and return structured critique."""
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
    prompt = f"""
Analyze this startup hypothesis and provide your critique:

**User's Input:**
"{raw_hypothesis}"

Apply the hypothesis template: "Specific [target customer] struggles with [problem] because [root cause]"

Return ONLY valid JSON matching the schema in your system instructions.
"""
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=CRITIC_SYSTEM_PROMPT,
                temperature=0.3,
                response_mime_type="application/json",
            ),
        )
        
        result = json.loads(response.text)
    except json.JSONDecodeError:
        text = getattr(response, 'text', '{}')
        start = text.find("{")
        end = text.rfind("}") + 1
        result = json.loads(text[start:end]) if start >= 0 else {}
    except Exception as e:
        print(f"Critic agent error: {e}")
        result = {
            "original_hypothesis": raw_hypothesis,
            "extraction": {
                "target_users": "Founders",
                "core_problem": "Market validation",
                "root_cause": "Lack of data",
                "impact": "Startup failure",
            },
            "clarity_score": 7,
            "improvement_suggestions": "Define the target niche more specifically",
            "is_problem_first": True,
            "refined_hypothesis": raw_hypothesis,
            "assumptions_challenged": ["Market size", "Pain severity"],
            "critical_risks": [{"risk": "Competition", "severity": "medium", "mitigation": "Research"}],
            "readiness_to_research": True,
        }
    
    return result
