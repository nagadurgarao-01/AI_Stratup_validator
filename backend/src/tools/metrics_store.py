"""Metric event storage for engagement/KPI tracking (Firestore with in-memory fallback)."""
from __future__ import annotations

import datetime as dt
import uuid
from copy import deepcopy
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

_METRIC_EVENTS: list[dict[str, Any]] = []
_FIRESTORE_READY = False


def _ensure_firestore() -> bool:
    global _FIRESTORE_READY
    if _FIRESTORE_READY:
        return True

    try:
        if not firebase_admin._apps:
            firebase_admin.initialize_app(credentials.ApplicationDefault())
        _FIRESTORE_READY = True
    except Exception:
        _FIRESTORE_READY = False

    return _FIRESTORE_READY


def save_metric_event(event_type: str, payload: dict[str, Any] | None = None) -> None:
    """Persist a metric event for retention and usage analytics."""
    if not event_type.strip():
        return

    event = {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type.strip(),
        "payload": deepcopy(payload or {}),
        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
    }

    if _ensure_firestore():
        try:
            db = firestore.client()
            db.collection("metrics_events").document(event["event_id"]).set(event)
            return
        except Exception:
            pass

    _METRIC_EVENTS.append(event)


def _extract_day(iso_timestamp: str) -> str:
    try:
        return dt.datetime.fromisoformat(iso_timestamp).date().isoformat()
    except Exception:
        return dt.datetime.now(dt.timezone.utc).date().isoformat()


def _extract_actor(event: dict[str, Any]) -> str:
    payload = event.get("payload", {}) or {}
    uid = str(payload.get("uid", "")).strip()
    session_id = str(payload.get("session_id", "")).strip()
    if uid:
        return f"uid:{uid}"
    if session_id:
        return f"session:{session_id}"
    return "anonymous"


def _collect_events_since(days: int) -> list[dict[str, Any]]:
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    collected: list[dict[str, Any]] = []

    if _ensure_firestore():
        try:
            db = firestore.client()
            docs = db.collection("metrics_events").stream()
            for doc in docs:
                data = doc.to_dict() or {}
                ts_raw = str(data.get("timestamp", ""))
                try:
                    ts = dt.datetime.fromisoformat(ts_raw)
                except Exception:
                    continue
                if ts >= cutoff:
                    collected.append(data)
            return collected
        except Exception:
            pass

    for event in _METRIC_EVENTS:
        ts_raw = str(event.get("timestamp", ""))
        try:
            ts = dt.datetime.fromisoformat(ts_raw)
        except Exception:
            continue
        if ts >= cutoff:
            collected.append(deepcopy(event))

    return collected


def get_metric_summary(days: int = 7) -> dict[str, Any]:
    """Compute KPI summary over the trailing N days."""
    events = _collect_events_since(days)
    by_day: dict[str, set[str]] = {}
    counts = {
        "validation_started": 0,
        "validation_completed": 0,
        "validation_failed": 0,
        "report_page_view": 0,
        "validate_page_view": 0,
    }

    for event in events:
        day = _extract_day(str(event.get("timestamp", "")))
        actor = _extract_actor(event)
        by_day.setdefault(day, set()).add(actor)

        event_type = str(event.get("event_type", "")).strip()
        if event_type in counts:
            counts[event_type] += 1

    dau_by_day = [
        {"date": day, "active_users": len(actors)}
        for day, actors in sorted(by_day.items())
    ]
    avg_dau = round(
        sum(item["active_users"] for item in dau_by_day) / len(dau_by_day),
        2,
    ) if dau_by_day else 0.0

    completion_rate = 0.0
    if counts["validation_started"] > 0:
        completion_rate = round(
            (counts["validation_completed"] / counts["validation_started"]) * 100,
            2,
        )

    return {
        "window_days": days,
        "event_count": len(events),
        "counts": counts,
        "avg_dau": avg_dau,
        "dau_by_day": dau_by_day,
        "validation_completion_rate_percent": completion_rate,
    }
