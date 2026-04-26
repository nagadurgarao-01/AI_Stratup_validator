"""Report persistence with Firestore primary and in-memory fallback for local dev."""
from __future__ import annotations

import datetime as dt
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

# In-memory fallback for local development when Firestore is not configured.
_IN_MEMORY_REPORTS: dict[str, dict[str, Any]] = {}
_FIRESTORE_READY = False
_FALLBACK_DIR = Path(__file__).resolve().parents[2] / ".data" / "reports"


def _write_local_report(session_id: str, payload: dict[str, Any]) -> None:
    """Persist report to local disk so it survives process restarts in dev."""
    try:
        _FALLBACK_DIR.mkdir(parents=True, exist_ok=True)
        target = _FALLBACK_DIR / f"{session_id}.json"
        target.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")
    except Exception as exc:
        print(f"[REPORT] Local write fallback failed for {session_id}: {exc}")


def _read_local_report(session_id: str) -> dict[str, Any] | None:
    """Load locally persisted report when Firestore is unavailable."""
    target = _FALLBACK_DIR / f"{session_id}.json"
    if not target.exists():
        return None

    try:
        data = json.loads(target.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data.setdefault("session_id", session_id)
            return data
    except Exception as exc:
        print(f"[REPORT] Local read fallback failed for {session_id}: {exc}")

    return None


def _ensure_firestore() -> bool:
    """Initialize Firebase Admin SDK once and return whether Firestore is available."""
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


def save_report(report: dict[str, Any]) -> None:
    """Persist final report using Firestore when available, otherwise keep in memory."""
    session_id = str(report.get("session_id", "")).strip()
    if not session_id:
        return

    payload = deepcopy(report)
    payload["saved_at"] = dt.datetime.now(dt.timezone.utc).isoformat()

    if _ensure_firestore():
        try:
            db = firestore.client()
            db.collection("reports").document(session_id).set(payload)
            return
        except Exception:
            # Fallback to memory if Firestore write fails in local/dev environments.
            pass

    _IN_MEMORY_REPORTS[session_id] = payload
    _write_local_report(session_id, payload)


def get_report(session_id: str) -> dict[str, Any] | None:
    """Load report from Firestore or in-memory fallback."""
    sid = session_id.strip()
    if not sid:
        return None

    if _ensure_firestore():
        try:
            db = firestore.client()
            doc = db.collection("reports").document(sid).get()
            if doc.exists:
                data = doc.to_dict() or {}
                data.setdefault("session_id", sid)
                return data
        except Exception:
            pass

    cached = _IN_MEMORY_REPORTS.get(sid)
    if cached:
        return deepcopy(cached)

    return _read_local_report(sid)
