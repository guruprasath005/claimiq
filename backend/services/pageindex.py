"""
PageIndex tree search service.

Each insurer has up to 3 tree types:
  - policy_docs/{doc_slug}.json  (one per Cleaned Notes PDF)
  - claims.json                  (aggregated Claims web clippings)
  - policies_services.json       (aggregated Policies & Services web clippings)

For a claim query we search:
  1. All policy_docs trees → coverage, exclusions, sub-limits, ICD restrictions
  2. claims.json           → required documents, claim process, rejection reasons
  3. policies_services.json → policy wordings, waiting periods

Returns a flat list of relevant sections with content.
"""

import json
from pathlib import Path
from backend.services.llm import chat
from backend.config import settings


def _load_tree_file(path: Path) -> dict | None:
    if path.exists():
        return json.loads(path.read_text())
    return None


def get_insurer_trees(insurer_slug: str) -> dict[str, list[dict]]:
    """
    Returns all available trees for an insurer:
    {
      "policy_docs": [...tree dicts...],
      "claims": tree_dict | None,
      "policies_services": tree_dict | None,
    }
    """
    base = settings.tree_index_dir / insurer_slug

    policy_docs = []
    pd_dir = base / "policy_docs"
    if pd_dir.exists():
        for f in sorted(pd_dir.glob("*.json")):
            t = _load_tree_file(f)
            if t:
                policy_docs.append(t)

    return {
        "policy_docs"       : policy_docs,
        "claims"            : _load_tree_file(base / "claims.json"),
        "policies_services" : _load_tree_file(base / "policies_services.json"),
    }


SEARCH_SYSTEM = """
You are a medical insurance expert navigating a PageIndex tree of insurance documents.

Given a clinical query and a tree index, reason through the tree to find the 5–8
most relevant sections. Focus on:
- Coverage and inclusion rules
- Exclusions and waiting periods
- ICD code restrictions
- Required documents for claim submission
- Sub-limits and caps
- Pre-authorisation requirements

Return JSON: {"nodes": [{"node_id": "...", "title": "...", "reason": "..."}]}
"""


async def _search_one_tree(tree_data: dict, clinical_query: str, label: str) -> tuple[list[dict], dict]:
    """Run PageIndex tree search on a single tree. Returns (nodes, usage)."""
    try:
        tree_json = json.dumps(tree_data.get("tree", tree_data), ensure_ascii=False)
        response  = await chat(
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SEARCH_SYSTEM},
                {"role": "user",   "content": (
                    f"Query: {clinical_query}\n\n"
                    f"Source: {label}\n\n"
                    f"Tree index:\n{tree_json}"
                )},
            ],
        )
        usage = response.usage
        token_dict = {
            "prompt":     getattr(usage, "prompt_tokens",     0) or 0,
            "completion": getattr(usage, "completion_tokens", 0) or 0,
            "total":      getattr(usage, "total_tokens",      0) or 0,
        } if usage else {}
        nodes = json.loads(response.choices[0].message.content).get("nodes", [])
        for n in nodes:
            n["source"] = label
        return nodes, token_dict
    except Exception as e:
        print(f"[WARN] tree search failed for {label}: {e}")
        return [], {}


async def search_insurer(insurer_slug: str, clinical_query: str) -> tuple[list[dict], dict]:
    """
    Search all trees for the given insurer and return combined relevant sections + token usage.
    Returns (sections, token_usage_dict).
    """
    import asyncio

    trees = get_insurer_trees(insurer_slug)
    tasks = []

    for pd_tree in trees["policy_docs"]:
        label = f"Policy Doc: {pd_tree.get('source_file', 'unknown')}"
        tasks.append(_search_one_tree(pd_tree, clinical_query, label))

    if trees["claims"]:
        tasks.append(_search_one_tree(trees["claims"], clinical_query, "Claims Process"))

    if trees["policies_services"]:
        tasks.append(_search_one_tree(trees["policies_services"], clinical_query, "Policies & Services"))

    if not tasks:
        return [], {}

    results = await asyncio.gather(*tasks)

    all_nodes: list[dict] = []
    combined_usage: dict  = {}
    for nodes, usage in results:
        all_nodes.extend(nodes)
        for k, v in usage.items():
            combined_usage[k] = combined_usage.get(k, 0) + v

    seen:  set  = set()
    dedup: list = []
    for n in all_nodes:
        key = f"{n.get('source')}::{n.get('node_id')}"
        if key not in seen:
            seen.add(key)
            dedup.append(n)

    return dedup[:10], combined_usage
