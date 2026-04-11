"""
services/cefr_classifier.py

Servico de classificacao de nivel CEFR usando o modelo treinado em
models/cefr_classifier.pkl.

Carregamento lazy (singleton): o .pkl e carregado na primeira chamada
e mantido em memoria durante toda a vida do processo.
"""

import os

import joblib

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "cefr_classifier.pkl")

_model = None  # singleton


def _load_model():
    global _model
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    return _model


def classify_text(text: str) -> dict:
    """
    Classifica o nivel CEFR de um texto em ingles.

    Parametros
    ----------
    text : str
        Texto a ser classificado.

    Retorna
    -------
    dict com as chaves:
        predicted_level : str | None  — nivel previsto (A1-C2) ou None
        confidence      : float       — probabilidade maxima do modelo (0.0-1.0)
        message         : str         — "ok" ou "texto_muito_curto"
    """
    if len(text.split()) < 20:
        return {
            "predicted_level": None,
            "confidence": 0.0,
            "message": "texto_muito_curto",
        }

    model = _load_model()
    proba = model.predict_proba([text])[0]
    predicted_level = model.classes_[proba.argmax()]
    confidence = float(proba.max())

    return {
        "predicted_level": predicted_level,
        "confidence": round(confidence, 4),
        "message": "ok",
    }


# ─────────────────────────────────────────────────────────────
# Teste rapido
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    short_text = "Hello, how are you today?"

    b1_text = (
        "Every day millions of people use public transport to get to work or school. "
        "Buses and trains are often crowded during rush hour, but they are much better "
        "for the environment than private cars. Many cities are now investing in new "
        "metro lines and cycle paths to reduce traffic and pollution in urban areas."
    )

    print("--- Texto curto (< 20 palavras) ---")
    result = classify_text(short_text)
    print(f"  Texto    : {short_text!r}")
    print(f"  Resultado: {result}")

    print()
    print("--- Paragrafo B1 ---")
    result = classify_text(b1_text)
    print(f"  Texto    : {b1_text[:60]}...")
    print(f"  Resultado: {result}")
