"""
Offline indexer — build searchable JSON trees from InsuranceData/.

Tree layout in indexer/tree_index/:
  {insurer_slug}/
    policy_docs/
      {doc_slug}.json     ← one tree per Cleaned Notes file
    claims.json           ← all Claims/*.md aggregated
    policies_services.json ← all Policies and services/*.md aggregated
  index.json              ← master map: insurer → slug + available trees

Usage:
  python3 -m indexer.build_index
  python3 -m indexer.build_index --insurer "HDFC ERGO"
  python3 -m indexer.build_index --category claims
"""

import os
import re
import json
import argparse
from pathlib import Path

import frontmatter
from tqdm import tqdm
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ROOT        = Path(__file__).parent.parent
DATA_DIR    = ROOT / "InsuranceData"
INDEX_DIR   = Path(__file__).parent / "tree_index"
INDEX_DIR.mkdir(exist_ok=True)

OPENAI_KEY    = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY", "")
INDEX_BASE    = os.getenv("INDEX_MODEL_URL", os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1"))
INDEX_MODEL   = os.getenv("INDEX_MODEL", "gemma-4-12b-it")

# Use "none" as key for local vllm endpoints that don't require auth
_index_key = OPENAI_KEY if not INDEX_BASE.startswith("http://") else "none"
client = OpenAI(api_key=_index_key, base_url=INDEX_BASE)

# ---------------------------------------------------------------------------
# Markdown helpers
# ---------------------------------------------------------------------------

def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def strip_frontmatter(path: Path) -> tuple[dict, str]:
    post = frontmatter.load(str(path))
    return dict(post.metadata), post.content.strip()


def format_pdf_doc(meta: dict, body: str, filename: str) -> str:
    title = meta.get("source_pdf", filename).replace(".pdf", "").replace("-", " ").replace("_", " ").title()
    return f"# {title}\n\n{body}"


def format_web_doc(meta: dict, body: str, filename: str) -> str:
    title = meta.get("title", "") or filename.replace(".md", "").replace("-", " ").title()
    body  = re.sub(r"^\s*#[^#][^\n]*\n", "", body, count=1)
    return f"# {title}\n\n{body}"


def collect_aggregate(folder: Path) -> str:
    parts = []
    for md in sorted(folder.rglob("*.md")):
        if ".obsidian" in str(md):
            continue
        meta, body = strip_frontmatter(md)
        parts.append(format_web_doc(meta, body, md.stem))
    return "\n\n---\n\n".join(parts)


# ---------------------------------------------------------------------------
# Section parser
# ---------------------------------------------------------------------------

def parse_sections(md_text: str) -> list[dict]:
    """
    Split markdown into sections by H1–H4 headers.
    Returns list of {node_id, title, level, content}.
    """
    sections  = []
    cur_title = "Preamble"
    cur_level = 0
    cur_lines: list[str] = []
    counter   = [0]

    def flush():
        content = "\n".join(cur_lines).strip()
        if content:
            counter[0] += 1
            sections.append({
                "node_id": f"n{counter[0]}",
                "title":   cur_title,
                "level":   cur_level,
                "content": content,
            })

    for line in md_text.split("\n"):
        m = re.match(r"^(#{1,4})\s+(.+)$", line)
        if m:
            flush()
            cur_level = len(m.group(1))
            cur_title = m.group(2).strip()
            cur_lines = []
        else:
            cur_lines.append(line)

    flush()
    return sections


# ---------------------------------------------------------------------------
# Tree builder — LLM summarisation via OpenRouter
# ---------------------------------------------------------------------------

_SUMMARISE_SYSTEM = """You are indexing insurance policy documents for an RCM (Revenue Cycle Management) system.

For each section you receive, write ONE concise sentence (≤ 20 words) summarising:
- What the section covers (coverage, exclusion, limit, procedure, waiting period, etc.)
- Any key numbers, conditions, or ICD restrictions if present

Return ONLY a JSON object: {"summaries": {"<node_id>": "<one-sentence summary>", ...}}
"""


def _summarise_batch(batch: list[dict]) -> dict[str, str]:
    """Ask the LLM to summarise a batch of sections. Returns {node_id: summary}."""
    if not batch:
        return {}

    sections_text = "\n\n".join(
        f"[{s['node_id']}] {s['title']}\n{s['content'][:600]}"
        for s in batch
    )

    try:
        resp = client.chat.completions.create(
            model=INDEX_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SUMMARISE_SYSTEM},
                {"role": "user",   "content": sections_text},
            ],
            timeout=120,
        )
        data = json.loads(resp.choices[0].message.content)
        return data.get("summaries", {})
    except Exception as e:
        print(f"    [WARN] summarise batch failed: {e}")
        # Fall back: use truncated content as summary
        return {s["node_id"]: s["content"][:120].replace("\n", " ") for s in batch}


def build_tree_from_md(md_text: str, label: str, summarize: bool = False) -> dict | None:
    """
    Build a navigable JSON tree from markdown text.
    When summarize=True, calls OpenRouter LLM to generate per-section summaries.
    When summarize=False (default), uses content snippets directly — no API calls needed.
    """
    if not md_text.strip():
        return None

    sections = parse_sections(md_text)
    if not sections:
        return None

    summaries: dict[str, str] = {}
    if summarize:
        batch_size = 15
        for i in range(0, len(sections), batch_size):
            batch = sections[i : i + batch_size]
            summaries.update(_summarise_batch(batch))

    nodes = []
    for s in sections:
        snippet = s["content"][:300].strip()
        nodes.append({
            "node_id":        s["node_id"],
            "title":          s["title"],
            "level":          s["level"],
            "summary":        summaries.get(s["node_id"], snippet[:120].replace("\n", " ")),
            "content_snippet": snippet,
        })

    doc_title = sections[0]["title"] if sections else label
    return {
        "title":    doc_title,
        "source":   label,
        "sections": nodes,
    }


# ---------------------------------------------------------------------------
# Per-insurer indexing
# ---------------------------------------------------------------------------

def index_insurer(insurer_dir: Path, categories: list[str] | None = None, summarize: bool = False) -> dict:
    name    = insurer_dir.name
    isl     = slug(name)
    out_dir = INDEX_DIR / isl
    out_dir.mkdir(parents=True, exist_ok=True)

    available_trees: list[str] = []

    # ── Cleaned Notes: one tree per document ─────────────────────────────────
    cleaned_dir = insurer_dir / "Cleaned Notes"
    if cleaned_dir.exists() and (not categories or "policy_docs" in categories):
        policy_dir = out_dir / "policy_docs"
        policy_dir.mkdir(exist_ok=True)
        md_files = sorted(cleaned_dir.rglob("*.md"))
        if md_files:
            print(f"    Building policy_docs ({len(md_files)} files)...")
        for md in tqdm(md_files, desc=f"  {isl}/policy_docs", leave=False):
            meta, body   = strip_frontmatter(md)
            md_text      = format_pdf_doc(meta, body, md.stem)
            doc_slug_val = slug(md.stem)
            out_path     = policy_dir / f"{doc_slug_val}.json"
            if out_path.exists():
                available_trees.append(f"{isl}/policy_docs/{doc_slug_val}")
                continue
            tree = build_tree_from_md(md_text, f"{isl}/{md.stem}", summarize=summarize)
            if tree:
                out_path.write_text(json.dumps({
                    "insurer":     name,
                    "slug":        isl,
                    "category":    "policy_docs",
                    "source_file": md.name,
                    "tree":        tree,
                }, indent=2, ensure_ascii=False))
                available_trees.append(f"{isl}/policy_docs/{doc_slug_val}")

    # ── Claims aggregate ──────────────────────────────────────────────────────
    claims_dir = insurer_dir / "Claims"
    if claims_dir.exists() and (not categories or "claims" in categories):
        out_path = out_dir / "claims.json"
        if not out_path.exists():
            print(f"    Building claims aggregate...")
            md_text = collect_aggregate(claims_dir)
            tree    = build_tree_from_md(md_text, f"{isl}/claims", summarize=summarize)
            if tree:
                out_path.write_text(json.dumps({
                    "insurer":  name,
                    "slug":     isl,
                    "category": "claims",
                    "tree":     tree,
                }, indent=2, ensure_ascii=False))
        if out_path.exists():
            available_trees.append(f"{isl}/claims")

    # ── Policies and services aggregate ──────────────────────────────────────
    policies_dir = insurer_dir / "Policies and services"
    if policies_dir.exists() and (not categories or "policies_services" in categories):
        out_path = out_dir / "policies_services.json"
        if not out_path.exists():
            print(f"    Building policies_services aggregate...")
            md_text = collect_aggregate(policies_dir)
            tree    = build_tree_from_md(md_text, f"{isl}/policies_services", summarize=summarize)
            if tree:
                out_path.write_text(json.dumps({
                    "insurer":  name,
                    "slug":     isl,
                    "category": "policies_services",
                    "tree":     tree,
                }, indent=2, ensure_ascii=False))
        if out_path.exists():
            available_trees.append(f"{isl}/policies_services")

    return {"insurer": name, "slug": isl, "trees": available_trees}


# ---------------------------------------------------------------------------
# Master index
# ---------------------------------------------------------------------------

def build_master_index(entries: list[dict]):
    path = INDEX_DIR / "index.json"
    path.write_text(json.dumps({"insurers": entries}, indent=2, ensure_ascii=False))
    print(f"\nMaster index saved → {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Build search trees for InsuranceData/")
    parser.add_argument("--insurer",  help="Index only this insurer (exact folder name)")
    parser.add_argument("--category",
                        choices=["policy_docs", "claims", "policies_services"],
                        help="Index only this category")
    parser.add_argument("--summarize", action="store_true",
                        help="Call LLM to generate 1-line summaries per section (requires API credits)")
    args = parser.parse_args()

    if not OPENAI_KEY:
        print("ERROR: OPENROUTER_API_KEY not set. Add it to .env or export it.")
        return

    print(f"Using API base:  {INDEX_BASE}")
    print(f"Using model:     {INDEX_MODEL}")
    print(f"LLM summarize:   {'yes (--summarize)' if args.summarize else 'no  (add --summarize to enable)'}\n")

    insurer_dirs = [
        d for d in sorted(DATA_DIR.iterdir())
        if d.is_dir() and not d.name.startswith(".") and d.name != "Clippings"
    ]

    if args.insurer:
        insurer_dirs = [d for d in insurer_dirs if d.name == args.insurer]
        if not insurer_dirs:
            print(f"Insurer '{args.insurer}' not found in {DATA_DIR}")
            return

    categories = [args.category] if args.category else None

    print(f"Indexing {len(insurer_dirs)} insurer(s)...\n")
    entries = []
    for d in insurer_dirs:
        print(f"=== {d.name} ===")
        entry = index_insurer(d, categories, summarize=args.summarize)
        entries.append(entry)
        print(f"    Done. Trees: {entry['trees']}\n")

    if not args.insurer and not args.category:
        build_master_index(entries)

    print("Indexing complete.")


if __name__ == "__main__":
    main()
