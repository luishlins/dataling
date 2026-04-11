"""
train_classifier.py

Treina um classificador de nivel CEFR (A1-C2) com TF-IDF + Logistic Regression.

Entrada : data/cefr_texts.csv  (colunas: text, cefr_level)
Saida   : models/cefr_classifier.pkl
"""

import os

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

# ─────────────────────────────────────────────────────────────
# Configuracoes
# ─────────────────────────────────────────────────────────────

DATA_PATH = "data/cefr_texts.csv"
MODEL_PATH = "models/cefr_classifier.pkl"

os.makedirs("models", exist_ok=True)

# ─────────────────────────────────────────────────────────────
# 1. Carregar dataset
# ─────────────────────────────────────────────────────────────

print("Carregando dataset...")
df = pd.read_csv(DATA_PATH)
print(f"  {len(df)} amostras | colunas: {list(df.columns)}")

X = df["text"]
y = df["cefr_level"]

# ─────────────────────────────────────────────────────────────
# 2. Divisao treino / validacao / teste  (70 / 15 / 15)
# ─────────────────────────────────────────────────────────────

X_train_val, X_test, y_train_val, y_test = train_test_split(
    X, y, test_size=0.15, stratify=y, random_state=42
)

X_train, X_val, y_train, y_val = train_test_split(
    X_train_val, y_train_val,
    test_size=0.15 / 0.85,   # ~17.65% do subconjunto = 15% do total
    stratify=y_train_val,
    random_state=42,
)

print(f"  Treino: {len(X_train)} | Validacao: {len(X_val)} | Teste: {len(X_test)}")

# ─────────────────────────────────────────────────────────────
# 3. Pipeline
# ─────────────────────────────────────────────────────────────

pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=10000)),
    ("clf",   LogisticRegression(C=1.0, max_iter=500, multi_class="multinomial",
                                 random_state=42)),
])

# ─────────────────────────────────────────────────────────────
# 4. Treinamento
# ─────────────────────────────────────────────────────────────

print("\nTreinando modelo...")
pipeline.fit(X_train, y_train)

# ─────────────────────────────────────────────────────────────
# 5. Avaliacao no conjunto de validacao
# ─────────────────────────────────────────────────────────────

print("\nClassification report (validacao):")
y_val_pred = pipeline.predict(X_val)
print(classification_report(y_val, y_val_pred))

# ─────────────────────────────────────────────────────────────
# 6. Salvar modelo
# ─────────────────────────────────────────────────────────────

joblib.dump(pipeline, MODEL_PATH)
print(f"Modelo salvo em {MODEL_PATH}")
