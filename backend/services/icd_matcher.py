"""
ICD-10 code matcher.

Maps free-text diagnoses/procedures from OCR to ICD-10 codes and
checks whether each code is covered under the detected scheme.
"""

import json
from backend.services.llm import chat
from backend.models.responses import IcdMatch


MATCH_SYSTEM = """
You are a certified medical coder (CPC) specializing in Indian insurance claims.

Given a list of diagnoses and procedures (free text) and relevant scheme coverage sections,
return ICD-10 codes and indicate if each is covered.

Return JSON:
{
  "codes": [
    {
      "code": "E11.22",
      "description": "Type 2 diabetes mellitus with diabetic chronic kidney disease",
      "scheme_covered": true,
      "restriction_note": null
    }
  ]
}
"""


async def match_icd(
    diagnoses: list[str],
    procedures: list[str],
    scheme_sections: list[dict],
) -> tuple[list[IcdMatch], dict]:
    """Returns (icd_codes, token_usage)."""

    scheme_context = "\n".join(
        s.get("content", "") for s in scheme_sections
    )

    response = await chat(
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": MATCH_SYSTEM},
            {"role": "user",   "content": (
                f"Diagnoses: {diagnoses}\n"
                f"Procedures: {procedures}\n\n"
                f"Scheme coverage sections:\n{scheme_context}"
            )},
        ],
    )

    usage = response.usage
    token_dict = {
        "prompt":     getattr(usage, "prompt_tokens",     0) or 0,
        "completion": getattr(usage, "completion_tokens", 0) or 0,
        "total":      getattr(usage, "total_tokens",      0) or 0,
    } if usage else {}

    raw   = json.loads(response.choices[0].message.content)
    codes = raw.get("codes", [])
    return [IcdMatch(**c) for c in codes], token_dict
