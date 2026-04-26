"""Calculator tool for Viability Score and financial metrics."""
from typing import TypedDict


class ViabilityInputs(TypedDict):
    market_viability: float    # 0-100
    financial_strength: float  # 0-100
    feasibility: float         # 0-100
    competitive_gap: float     # 0-100
    sdg_alignment: float       # 0-100


class MarketSizeInputs(TypedDict):
    total_potential_customers: int
    average_annual_revenue_per_user: float
    market_penetration_rate: float  # SAM as fraction of TAM
    obtainable_fraction: float      # SOM as fraction of SAM


class FinancialMetrics(TypedDict):
    tam: float
    sam: float
    som: float
    viability_score: float
    viability_label: str
    viability_color: str


def calculate_viability_score(inputs: ViabilityInputs) -> float:
    """
    Weighted Viability Score (Vs):
    - Market: 25% | Financial: 25% | Feasibility: 20% | Competition: 15% | SDG: 15%
    """
    score = (
        inputs["market_viability"] * 0.25
        + inputs["financial_strength"] * 0.25
        + inputs["feasibility"] * 0.20
        + inputs["competitive_gap"] * 0.15
        + inputs["sdg_alignment"] * 0.15
    )
    return round(min(max(score, 0), 100), 1)


def calculate_market_size(inputs: MarketSizeInputs) -> dict:
    """
    TAM = total_potential_customers * ARPU
    SAM = TAM * market_penetration_rate
    SOM = SAM * obtainable_fraction  (= potential_customers * ARPU per PRD formula)
    """
    tam = inputs["total_potential_customers"] * inputs["average_annual_revenue_per_user"]
    sam = tam * inputs["market_penetration_rate"]
    som = sam * inputs["obtainable_fraction"]

    return {
        "tam": round(tam, 2),
        "sam": round(sam, 2),
        "som": round(som, 2),
        "tam_formatted": _format_currency(tam),
        "sam_formatted": _format_currency(sam),
        "som_formatted": _format_currency(som),
    }


def get_viability_label(score: float) -> tuple[str, str]:
    """Returns (label, color) based on RAG traffic light system."""
    if score >= 70:
        return ("High Viability", "green")
    elif score >= 40:
        return ("Moderate Viability", "amber")
    else:
        return ("Low Viability", "red")


def _format_currency(value: float) -> str:
    """Format large numbers as readable currency strings."""
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    elif value >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    elif value >= 1_000:
        return f"${value / 1_000:.1f}K"
    else:
        return f"${value:.0f}"
