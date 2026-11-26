import re
from typing import List


def anonymize_legal_text(text: str, counterparty: str = "") -> str:
    """Strips counterparty names, INN, KPP, OGRN, bank accounts, phones, and emails."""
    cleaned = text or ""
    if counterparty:
        cleaned = cleaned.replace(counterparty, "[КОНТРАГЕНТ]")
    cleaned = re.sub(r"\b(ИНН|КПП|ОГРН|БИК|р/с|к/с)\s*[:№]?\s*\d[\d\s-]{6,22}\d", r"\1 [СКРЫТО]", cleaned, flags=re.I)
    cleaned = re.sub(r"\+?\d[\d\s()-]{8,16}\d", "[ТЕЛЕФОН]", cleaned)
    cleaned = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[EMAIL]", cleaned)
    return cleaned


def chunk_text(text: str, chunk_size_tokens: int = 512, overlap_tokens: int = 64) -> List[str]:
    words = (text or "").split()
    if not words:
        return []
    step = max(32, chunk_size_tokens - overlap_tokens)
    chunks: List[str] = []
    for idx in range(0, len(words), step):
        part = " ".join(words[idx: idx + chunk_size_tokens]).strip()
        if part:
            chunks.append(part)
        if idx + chunk_size_tokens >= len(words):
            break
    return chunks
