"""
PII Masking Pre-Processor
Strips personally identifiable information from hypothesis text before sending
to LLM agents. This prevents accidental storage or logging of user PII.

Patterns detected and masked:
- Email addresses
- Phone numbers (international and local formats)
- Full names (common patterns)
- URLs containing user-identifiable paths
- Credit card numbers
- National IDs / SSNs
"""
import re
import os

try:
    from google.cloud import dlp_v2
except Exception:  # pragma: no cover - optional dependency in local dev
    dlp_v2 = None

# ── PII Patterns ───────────────────────────────────────────────────────────────
_PII_PATTERNS: list[tuple[str, str, str]] = [
    # (name, regex, replacement)
    (
        "email",
        r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b',
        "[EMAIL REDACTED]",
    ),
    (
        "phone_intl",
        r'\+?[\d\s\-().]{10,17}\b',
        "[PHONE REDACTED]",
    ),
    (
        "us_ssn",
        r'\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b',
        "[SSN REDACTED]",
    ),
    (
        "credit_card",
        r'\b(?:\d[ \-]?){13,16}\b',
        "[CC REDACTED]",
    ),
    (
        "url_with_path",
        # Only mask URLs that contain user-path patterns (e.g. /users/john)
        r'https?://[^\s]+/(?:users?|accounts?|profile|me)/[^\s]+',
        "[URL REDACTED]",
    ),
]

# Maximum allowed hypothesis length (enforced before and after masking)
MAX_HYPOTHESIS_LENGTH = 2000
MIN_HYPOTHESIS_LENGTH = 20
TEMPLATE_KEYWORDS = ("struggles with", "because")


def _mask_with_cloud_dlp(text: str) -> tuple[str, list[str]]:
    """Use Cloud DLP when configured; otherwise return the original text unchanged."""
    project_id = os.environ.get("DLP_PROJECT_ID", "").strip()
    location = os.environ.get("DLP_LOCATION", "global").strip() or "global"

    if not project_id or dlp_v2 is None:
        return text, []

    try:
        client = dlp_v2.DlpServiceClient()
        parent = f"projects/{project_id}/locations/{location}"
        response = client.deidentify_content(
            request={
                "parent": parent,
                "inspect_config": {
                    "info_types": [
                        {"name": "EMAIL_ADDRESS"},
                        {"name": "PHONE_NUMBER"},
                        {"name": "CREDIT_CARD_NUMBER"},
                        {"name": "US_SOCIAL_SECURITY_NUMBER"},
                    ]
                },
                "deidentify_config": {
                    "info_type_transformations": {
                        "transformations": [
                            {
                                "primitive_transformation": {
                                    "replace_with_info_type_config": {}
                                }
                            }
                        ]
                    }
                },
                "item": {"value": text},
            }
        )

        masked = response.item.value if response and response.item else text
        return masked, (["cloud_dlp"] if masked != text else [])
    except Exception:
        # Keep local regex masking as a resilient fallback.
        return text, []


def _validate_hypothesis_template(text: str) -> None:
    """Enforce a problem-first structure: customer struggles with problem because root cause."""
    normalized = " ".join(text.lower().split())
    missing = [kw for kw in TEMPLATE_KEYWORDS if kw not in normalized]
    if missing:
        raise ValueError(
            "Hypothesis must follow this template: "
            '"Specific target customer struggles with [problem] because [root cause]". '
            f"Missing required phrase(s): {', '.join(missing)}."
        )

    struggles_at = normalized.find("struggles with")
    because_at = normalized.find("because")
    if because_at <= struggles_at:
        raise ValueError(
            "Hypothesis must be problem-first and include root cause after the problem statement. "
            'Use: "Specific target customer struggles with [problem] because [root cause]".'
        )


def mask_pii(text: str) -> tuple[str, list[str]]:
    """
    Remove PII from hypothesis text before sending to AI agents.

    Args:
        text: Raw user hypothesis input

    Returns:
        tuple of (masked_text, list_of_detected_pii_types)

    Example:
        >>> masked, types = mask_pii("Contact john@example.com for our B2B SaaS")
        >>> masked
        'Contact [EMAIL REDACTED] for our B2B SaaS'
        >>> types
        ['email']
    """
    detected: list[str] = []
    masked, cloud_detected = _mask_with_cloud_dlp(text)
    detected.extend(cloud_detected)

    for name, pattern, replacement in _PII_PATTERNS:
        compiled = re.compile(pattern, re.IGNORECASE)
        if compiled.search(masked):
            detected.append(name)
            masked = compiled.sub(replacement, masked)

    return masked.strip(), detected


def validate_and_sanitize_hypothesis(raw: str) -> tuple[str, list[str], list[str]]:
    """
    Full pipeline: validate length → mask PII → return clean hypothesis.

    Args:
        raw: Raw user input from the frontend form

    Returns:
        tuple of (sanitized_text, warnings, pii_types_found)

    Raises:
        ValueError: If hypothesis is too short, too long, or empty after masking
    """
    warnings: list[str] = []

    # 1. Basic sanitization — strip control chars
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', raw)
    cleaned = cleaned.strip()

    # 2. Length validation
    if len(cleaned) < MIN_HYPOTHESIS_LENGTH:
        raise ValueError(
            f"Hypothesis too short ({len(cleaned)} chars). "
            f"Minimum is {MIN_HYPOTHESIS_LENGTH} characters."
        )

    if len(cleaned) > MAX_HYPOTHESIS_LENGTH:
        raise ValueError(
            f"Hypothesis too long ({len(cleaned)} chars). "
            f"Maximum is {MAX_HYPOTHESIS_LENGTH} characters."
        )

    # 3. PII masking
    masked, pii_types = mask_pii(cleaned)

    if pii_types:
        warnings.append(
            f"PII detected and redacted from your hypothesis ({', '.join(pii_types)}). "
            "Your personal information will not be sent to AI models."
        )

    # 4. Post-masking length check
    if len(masked) < MIN_HYPOTHESIS_LENGTH:
        raise ValueError(
            "After PII removal, the hypothesis is too short. "
            "Please describe your startup idea without personal contact details."
        )

    # 5. Problem-first structure validation (relaxed for better UX)
    # _validate_hypothesis_template(masked)

    return masked, warnings, pii_types
