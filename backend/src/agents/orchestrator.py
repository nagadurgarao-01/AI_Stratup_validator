"""
Orchestrator Agent — Master coordinator using sequential + parallel dispatch pattern.

Flow:
1. Critic Agent (sequential - must validate hypothesis first)
2. Market Research + Competitor Intel (parallel - independent tasks)
3. Financial Model Agent (sequential - needs research output)
4. Asset Generator Agent (sequential - needs financial model)
5. Compute final Viability Score and stream result
"""
import asyncio
import json
import uuid
import time
from typing import AsyncGenerator
from src.agents.critic_agent import run_critic_agent
from src.agents.market_research import run_market_research_agent
from src.agents.competitor_intel import run_competitor_intel_agent
from src.agents.financial_model import run_financial_model_agent
from src.agents.asset_generator import run_asset_generator_agent
from src.agents.sdg_agent import run_sdg_agent
from src.agents.pivot_agent import run_pivot_agent


async def orchestrate_validation(
    raw_hypothesis: str,
    session_id: str | None = None,
) -> AsyncGenerator[dict, None]:
    """
    Main orchestration flow — yields progress events for SSE streaming.
    
    Args:
        raw_hypothesis: User's raw startup idea/hypothesis
        session_id: Optional session ID for Firestore persistence
        
    Yields:
        Dicts with 'stage', 'status', 'data', and 'progress' (0-100) keys
    """
    if not session_id:
        session_id = str(uuid.uuid4())

    start_time = time.perf_counter()
    
    full_report = {
        "session_id": session_id,
        "kpi": {
            "target_processing_seconds": 120,
        },
    }
    
    # ─── Stage 1: Critic Agent ─────────────────────────────────────────────
    yield {
        "stage": "critic",
        "status": "running",
        "message": "🔍 Challenging your hypothesis...",
        "progress": 5,
    }
    
    try:
        critic_result = await run_critic_agent(raw_hypothesis)
        full_report["critic"] = critic_result
        refined_hypothesis = critic_result.get("refined_hypothesis", raw_hypothesis)
        
        yield {
            "stage": "critic",
            "status": "complete",
            "message": "✅ Hypothesis validated and refined",
            "data": critic_result,
            "progress": 20,
        }
    except Exception as e:
        yield {"stage": "critic", "status": "error", "message": f"Critic agent error: {e}", "progress": 20}
        refined_hypothesis = raw_hypothesis
        critic_result = {}
    
    # ─── Stage 2: Market Research + Competitor Intel (PARALLEL) ────────────
    yield {
        "stage": "research",
        "status": "running",
        "message": "🌐 Researching market and competitors simultaneously...",
        "progress": 25,
    }
    
    try:
        # Dispatch both agents in parallel — independent tasks
        market_task = asyncio.create_task(
            run_market_research_agent(refined_hypothesis)
        )
        competitor_task = asyncio.create_task(
            run_competitor_intel_agent(refined_hypothesis, {})
        )
        
        # Yield progress while waiting
        yield {
            "stage": "research",
            "status": "running",
            "message": "📊 Scanning market trends and competitor landscape...",
            "progress": 35,
        }
        
        # Wait for both to complete
        market_data, competitor_data = await asyncio.gather(
            market_task, competitor_task, return_exceptions=True
        )
        
        # Handle individual failures gracefully
        if isinstance(market_data, Exception):
            market_data = {"overall_demand_signal": 50, "market_size": {}}
        if isinstance(competitor_data, Exception):
            competitor_data = {"competitive_gap_score": 50, "direct_competitors": []}
        
        full_report["market_research"] = market_data
        full_report["competitor_intel"] = competitor_data
        
        yield {
            "stage": "research",
            "status": "complete",
            "message": "✅ Market and competitive research complete",
            "data": {
                "market": market_data,
                "competitors": competitor_data,
            },
            "progress": 55,
        }
    except Exception as e:
        yield {"stage": "research", "status": "error", "message": f"Research error: {e}", "progress": 55}
        market_data = {"overall_demand_signal": 50, "market_size": {}}
        competitor_data = {"competitive_gap_score": 50, "direct_competitors": []}

    # ─── Stage 2.5: SDG Impact (NEW) ───────────────────────────────────────
    yield {
        "stage": "sdg",
        "status": "running",
        "message": "🌍 Analyzing UN SDG alignment...",
        "progress": 57,
    }
    try:
        sdg_result = await run_sdg_agent(refined_hypothesis)
        full_report["sdg"] = sdg_result
        yield {
            "stage": "sdg",
            "status": "complete",
            "message": f"✅ SDG Impact: {len(sdg_result.get('sdg_numbers', []))} goals identified",
            "data": sdg_result,
            "progress": 60,
        }
    except Exception as e:
        yield {"stage": "sdg", "status": "error", "message": f"SDG agent error: {e}", "progress": 60}
        sdg_result = {"score": 50, "sdg_numbers": [8, 9], "sdg_tags": ["Goal 8", "Goal 9"]}
    
    # ─── Stage 3: Financial Model ──────────────────────────────────────────
    yield {
        "stage": "financial",
        "status": "running",
        "message": "💰 Building financial model and computing Viability Score...",
        "progress": 60,
    }
    
    try:
        market_data["sdg_score"] = sdg_result.get("score", 50)
        financial_data = await run_financial_model_agent(
            refined_hypothesis, market_data, competitor_data
        )
        full_report["financial_model"] = financial_data
        
        yield {
            "stage": "financial",
            "status": "complete",
            "message": f"✅ Viability Score: {financial_data.get('viability_score', 0)}/100",
            "data": financial_data,
            "progress": 75,
        }
    except Exception as e:
        yield {"stage": "financial", "status": "error", "message": f"Financial model error: {e}", "progress": 75}
        financial_data = {"viability_score": 50, "viability_label": "Moderate Viability", "market_metrics": {}}
    
    # ─── Stage 4: Asset Generation ─────────────────────────────────────────
    yield {
        "stage": "assets",
        "status": "running",
        "message": "📄 Generating business plan and brand identity...",
        "progress": 80,
    }
    
    try:
        asset_data = await run_asset_generator_agent(
            refined_hypothesis, market_data, competitor_data, financial_data
        )
        full_report["assets"] = asset_data
        
        yield {
            "stage": "assets",
            "status": "complete",
            "message": "✅ Business plan and brand kit ready",
            "data": asset_data,
            "progress": 95,
        }
    except Exception as e:
        yield {"stage": "assets", "status": "error", "message": f"Asset generation error: {e}", "progress": 95}
        asset_data = {}

    # ─── Stage 4.5: Pivot Engine (NEW) ─────────────────────────────────────
    v_score = financial_data.get("viability_score", 0)
    if v_score < 65:
        yield {
            "stage": "pivot",
            "status": "running",
            "message": "🔄 High risk detected. Generating pivot suggestions...",
            "progress": 97,
        }
        try:
            pivots = await run_pivot_agent(refined_hypothesis, {"overall": v_score, "sdg": sdg_result.get("score")})
            full_report["pivots"] = pivots
            yield {
                "stage": "pivot",
                "status": "complete",
                "message": "✅ Strategic pivots generated",
                "data": pivots,
                "progress": 99,
            }
        except Exception as e:
            yield {"stage": "pivot", "status": "error", "message": f"Pivot engine error: {e}", "progress": 99}
            full_report["pivots"] = []
    else:
        full_report["pivots"] = []
    
    # ─── Stage 5: Final Report ─────────────────────────────────────────────
    elapsed_seconds = round(time.perf_counter() - start_time, 2)
    full_report["kpi"].update({
        "total_processing_seconds": elapsed_seconds,
        "processing_within_target": elapsed_seconds <= 120,
    })

    yield {
        "stage": "complete",
        "status": "complete",
        "message": "🎉 Validation complete! Your report is ready.",
        "data": full_report,
        "progress": 100,
    }
