"""
Create StobaeusDocx database schema and seed insurer rows from InsuranceData/.

Usage:
    python3 db/setup_db.py
    python3 db/setup_db.py --url postgresql://user:pass@host/dbname
"""

import os
import re
import sys
import argparse
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

SCHEMA_FILE = Path(__file__).parent / "schema.sql"
DATA_DIR    = ROOT / "InsuranceData"


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def get_insurers() -> list[tuple[str, str]]:
    rows = []
    for d in sorted(DATA_DIR.iterdir()):
        if d.is_dir() and not d.name.startswith(".") and d.name != "Clippings":
            rows.append((d.name, slug(d.name)))
    return rows


def setup(url: str):
    print(f"Connecting to: {url}\n")
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()

    print("Creating schema...")
    cur.execute(SCHEMA_FILE.read_text())
    print("  ✓ Tables created")

    print("\nSeeding insurers...")
    insurers = get_insurers()
    for name, sl in insurers:
        cur.execute(
            """
            INSERT INTO insurers (name, slug)
            VALUES (%s, %s)
            ON CONFLICT (slug) DO NOTHING
            """,
            (name, sl),
        )
        print(f"  ✓ {name}")

    print(f"\nSeeding index_status rows...")
    tree_index = ROOT / "indexer" / "tree_index"
    for name, sl in insurers:
        insurer_dir = DATA_DIR / name
        for category, folder_name in [
            ("claims",             "Claims"),
            ("policies_services",  "Policies and services"),
        ]:
            if (insurer_dir / folder_name).exists():
                tree_path = f"{sl}/{category}.json"
                status    = "indexed" if (tree_index / sl / f"{category}.json").exists() else "pending"
                cur.execute(
                    """
                    INSERT INTO index_status (insurer_name, insurer_slug, category, tree_path, status)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (insurer_slug, category, COALESCE(source_file, '__agg__')) DO UPDATE
                        SET status = EXCLUDED.status
                    """,
                    (name, sl, category, tree_path, status),
                )

        # policy_docs: one row per source .md file
        cleaned_dir = insurer_dir / "Cleaned Notes"
        if cleaned_dir.exists():
            for md in sorted(cleaned_dir.rglob("*.md")):
                if ".obsidian" in str(md):
                    continue
                doc_slug  = slug(md.stem)
                tree_path = f"{sl}/policy_docs/{doc_slug}.json"
                status    = "indexed" if (tree_index / sl / "policy_docs" / f"{doc_slug}.json").exists() else "pending"
                cur.execute(
                    """
                    INSERT INTO index_status (insurer_name, insurer_slug, category, source_file, tree_path, status)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (insurer_slug, category, COALESCE(source_file, '__agg__')) DO UPDATE
                        SET status = EXCLUDED.status
                    """,
                    (name, sl, "policy_docs", md.name, tree_path, status),
                )

        print(f"  ✓ {name}")

    cur.close()
    conn.close()
    print("\nDone. Database ready.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=os.getenv("DATABASE_URL", "postgresql://localhost:5432/stobaeus"))
    args = parser.parse_args()
    setup(args.url)
