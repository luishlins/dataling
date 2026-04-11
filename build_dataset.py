"""
build_dataset.py

Gera data/cefr_texts.csv com colunas 'text' e 'cefr_level' (A1–C2).

Fontes:
  1. OneStopEnglish Corpus — baixado automaticamente do GitHub
     (Ele→B1, Int→B2, Adv→C1)
  2. Callan Method PDFs em callan_pdfs/
     (livros 1-2→A1, 3-4→A2, 5-6→B1, 7-8→B2, 9-10→C1, 11-12→C2)
"""

import io
import os
import re
import zipfile

import pandas as pd
import requests
from pdfminer.high_level import extract_text

# ─────────────────────────────────────────────────────────────
# Configurações
# ─────────────────────────────────────────────────────────────

OUTPUT_PATH = "data/cefr_texts.csv"
CALLAN_DIR = "callan_pdfs"

# OneStopEnglish no GitHub (arquivo ZIP do repositório)
ONESTOP_ZIP_URL = (
    "https://github.com/nishkalavallabhi/OneStopEnglishCorpus/archive/refs/heads/master.zip"
)

ONESTOP_LEVEL_MAP = {
    "Ele": "B1",
    "Int": "B2",
    "Adv": "C1",
}

# Mapeamento Callan: padrão no nome do arquivo → nível CEFR
CALLAN_LEVEL_MAP = {
    r"1\s*&\s*2": "A1",
    r"3\s*&\s*4": "A2",
    r"5\s*&\s*6": "B1",
    r"7\s*&\s*8": "B2",
    r"9\s*&\s*10": "C1",
    r"11\s*&\s*12": "C2",
}

# Tamanho mínimo de um trecho (caracteres)
MIN_CHUNK = 80
# Tamanho máximo de um trecho (caracteres) — aproximadamente um parágrafo
MAX_CHUNK = 600


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def clean(text: str) -> str:
    """Remove espaços extras e linhas em branco consecutivas."""
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_paragraphs(text: str) -> list[str]:
    """Divide o texto em parágrafos e filtra pelo tamanho."""
    paras = re.split(r"\n{2,}", text)
    chunks = []
    for p in paras:
        p = p.replace("\n", " ").strip()
        if len(p) < MIN_CHUNK:
            continue
        # Se o parágrafo for muito longo, divide em frases
        if len(p) > MAX_CHUNK:
            sentences = re.split(r"(?<=[.!?])\s+", p)
            buf = ""
            for s in sentences:
                if len(buf) + len(s) + 1 <= MAX_CHUNK:
                    buf = (buf + " " + s).strip()
                else:
                    if len(buf) >= MIN_CHUNK:
                        chunks.append(buf)
                    buf = s
            if len(buf) >= MIN_CHUNK:
                chunks.append(buf)
        else:
            chunks.append(p)
    return chunks


# ─────────────────────────────────────────────────────────────
# Fonte 1: OneStopEnglish
# ─────────────────────────────────────────────────────────────

def load_onestop() -> list[dict]:
    print("Baixando OneStopEnglish Corpus do GitHub…")
    resp = requests.get(ONESTOP_ZIP_URL, timeout=60)
    resp.raise_for_status()

    records = []
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        for name in zf.namelist():
            # Arquivos .txt dentro de Texts-SeparatedByReadingLevel/<Level>-Txt/
            m = re.search(
                r"Texts-SeparatedByReadingLevel/(Ele|Int|Adv)-Txt/(.+\.txt)$",
                name,
            )
            if not m:
                continue
            level_key = m.group(1)
            cefr = ONESTOP_LEVEL_MAP[level_key]
            raw = zf.read(name).decode("utf-8", errors="replace")
            text = clean(raw)
            for chunk in split_paragraphs(text):
                records.append({"text": chunk, "cefr_level": cefr})

    print(f"  OneStopEnglish: {len(records)} trechos extraídos")
    return records


# ─────────────────────────────────────────────────────────────
# Fonte 2: Callan Method PDFs
# ─────────────────────────────────────────────────────────────

def _callan_level(filename: str) -> str | None:
    for pattern, level in CALLAN_LEVEL_MAP.items():
        if re.search(pattern, filename):
            return level
    return None


def load_callan() -> list[dict]:
    records = []
    if not os.path.isdir(CALLAN_DIR):
        print(f"  Pasta '{CALLAN_DIR}' não encontrada — pulando Callan.")
        return records

    pdfs = [f for f in os.listdir(CALLAN_DIR) if f.lower().endswith(".pdf")]
    if not pdfs:
        print(f"  Nenhum PDF em '{CALLAN_DIR}' — pulando Callan.")
        return records

    print(f"Processando {len(pdfs)} PDFs do Callan Method…")
    for fname in sorted(pdfs):
        level = _callan_level(fname)
        if level is None:
            print(f"  [AVISO] Não foi possível inferir nível de '{fname}' — pulando.")
            continue
        path = os.path.join(CALLAN_DIR, fname)
        try:
            raw = extract_text(path)
        except Exception as exc:
            print(f"  [ERRO] Falha ao ler '{fname}': {exc} — pulando.")
            continue
        text = clean(raw)
        chunks = split_paragraphs(text)
        print(f"  {fname}  ->  {level}  ({len(chunks)} trechos)")
        for chunk in chunks:
            records.append({"text": chunk, "cefr_level": level})

    print(f"  Callan: {len(records)} trechos extraídos")
    return records


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

def main() -> None:
    os.makedirs("data", exist_ok=True)

    rows: list[dict] = []
    rows.extend(load_onestop())
    rows.extend(load_callan())

    if not rows:
        raise RuntimeError("Nenhum dado foi extraído. Verifique as fontes.")

    df = pd.DataFrame(rows, columns=["text", "cefr_level"])
    df = df.drop_duplicates(subset="text").reset_index(drop=True)

    df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8")

    print(f"\nDataset salvo em '{OUTPUT_PATH}'")
    print(f"Total de amostras: {len(df)}")
    print(f"Distribuição por nível:\n{df['cefr_level'].value_counts().sort_index()}")
    print("\nPrimeiras 5 linhas:")
    for _, row in df.head(5).iterrows():
        snippet = row["text"][:80].encode("ascii", errors="replace").decode("ascii")
        print(f"  [{row['cefr_level']}] {snippet}...")


if __name__ == "__main__":
    main()
