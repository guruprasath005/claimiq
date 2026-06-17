#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  StobaeusDocx — Interactive Indexer
#  Usage: ./index.sh
#  Requires: bash 3.2+ (macOS default), Python 3 in PATH
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSURANCE_DATA="$SCRIPT_DIR/InsuranceData"
TREE_INDEX="$SCRIPT_DIR/indexer/tree_index"
ENV_FILE="$SCRIPT_DIR/.env"

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

ok()  { printf "${GREEN}✓${RESET} %s\n" "$*"; }
err() { printf "${YELLOW}✗${RESET} %s\n" "$*" >&2; }
hdr() { printf "\n${BOLD}%s${RESET}\n" "$*"; }
sep() { printf "${DIM}────────────────────────────────────────────────────────${RESET}\n"; }
dim() { printf "${DIM}%s${RESET}\n" "$*"; }

# ── Load .env ─────────────────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
    while IFS='=' read -r key val; do
        [[ -z "$key" || "${key:0:1}" == "#" ]] && continue
        val="${val%%#*}"              # strip inline comments
        val="${val%"${val##*[! ]}"}" # rtrim
        export "$key=$val"
    done < "$ENV_FILE"
fi

API_KEY="${OPENROUTER_API_KEY:-${OPENAI_API_KEY:-}}"
LOCAL_INDEX_URL="${INDEX_MODEL_URL:-}"

# ── Slug helper ───────────────────────────────────────────────────────────────
to_slug() {
    printf '%s' "$1" | tr '[:upper:]' '[:lower:]' \
        | tr -cs 'a-z0-9' '-' \
        | sed 's/^-//;s/-$//'
}

count_md() {
    local dir="$1"
    if [[ -d "$dir" ]]; then
        find "$dir" -name "*.md" ! -path "*/.obsidian/*" 2>/dev/null | wc -l | tr -d ' '
    else
        printf '0'
    fi
}

count_json() {
    local dir="$1"
    if [[ -d "$dir" ]]; then
        find "$dir" -maxdepth 1 -name "*.json" 2>/dev/null | wc -l | tr -d ' '
    else
        printf '0'
    fi
}

# ── Build insurer list (bash 3.2 compatible) ──────────────────────────────────
INSURER_LIST=()
while IFS= read -r -d '' d; do
    name="$(basename "$d")"
    [[ "$name" == "Clippings" || "${name:0:1}" == "." ]] && continue
    INSURER_LIST+=("$name")
done < <(find "$INSURANCE_DATA" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

NUM_INSURERS=${#INSURER_LIST[@]}

# ─────────────────────────────────────────────────────────────────────────────
#  STATUS TABLE
# ─────────────────────────────────────────────────────────────────────────────
print_status() {
    hdr "Insurance Index Status"
    sep
    printf "  ${BOLD}%-3s  %-40s %-12s %-14s %-12s${RESET}\n" \
        "#" "Insurer" "Claims" "Policies" "Policy Docs"
    sep

    local i=1
    for name in "${INSURER_LIST[@]}"; do
        local sl
        sl=$(to_slug "$name")

        local claims_src policies_src docs_src docs_idx
        claims_src=$(count_md "$INSURANCE_DATA/$name/Claims")
        policies_src=$(count_md "$INSURANCE_DATA/$name/Policies and services")
        docs_src=$(count_md "$INSURANCE_DATA/$name/Cleaned Notes")
        docs_idx=$(count_json "$TREE_INDEX/$sl/policy_docs")

        # Claims column
        if [[ -f "$TREE_INDEX/$sl/claims.json" ]]; then
            c_col="${GREEN}✓ indexed${RESET}"
        elif (( claims_src > 0 )); then
            c_col="${YELLOW}○ pending${RESET}"
        else
            c_col="${DIM}— none${RESET}"
        fi

        # Policies column
        if [[ -f "$TREE_INDEX/$sl/policies_services.json" ]]; then
            p_col="${GREEN}✓ indexed${RESET}"
        elif (( policies_src > 0 )); then
            p_col="${YELLOW}○ pending${RESET}"
        else
            p_col="${DIM}— none${RESET}"
        fi

        # Policy docs column
        if (( docs_src == 0 )); then
            d_col="${DIM}— none${RESET}"
        elif (( docs_idx >= docs_src )); then
            d_col="${GREEN}✓ ${docs_idx}/${docs_src}${RESET}"
        elif (( docs_idx > 0 )); then
            d_col="${YELLOW}~ ${docs_idx}/${docs_src}${RESET}"
        else
            d_col="${YELLOW}○ 0/${docs_src}${RESET}"
        fi

        printf "  %-3s  %-40s" "$i" "$name"
        printf "%-22b %-24b %-20b\n" "$c_col" "$p_col" "$d_col"
        (( i++ ))
    done
    sep
}

# ─────────────────────────────────────────────────────────────────────────────
#  MODEL SELECTION
# ─────────────────────────────────────────────────────────────────────────────
MODEL_IDS=(
    "gemma-4-12b-it"
    "google/gemma-3-27b-it:free"
    "meta-llama/llama-3.3-70b-instruct:free"
    "nvidia/llama-3.1-nemotron-70b-instruct:free"
    "deepseek/deepseek-r1-0528:free"
    "google/gemma-3-12b-it:free"
    "microsoft/phi-4:free"
    "openai/gpt-4o"
    "openai/gpt-4o-mini"
)
MODEL_DESCS=(
    "Gemma 4 12B          (local vllm @ ${LOCAL_INDEX_URL:-http://10.10.116.160:11632/v1})"
    "Gemma 3 27B          (free, OpenRouter)"
    "Llama 3.3 70B        (free, OpenRouter)"
    "Nemotron 70B         (free, OpenRouter)"
    "DeepSeek R1          (free, OpenRouter)"
    "Gemma 3 12B          (free, OpenRouter)"
    "Phi-4 14B            (free, OpenRouter)"
    "GPT-4o               (paid, OpenRouter)"
    "GPT-4o Mini          (paid, OpenRouter)"
)

select_model() {
    hdr "Select Indexing Model"
    sep
    local current="${INDEX_MODEL:-gemma-4-12b-it}"
    dim "  Current: $current"
    echo ""

    local i=1
    local total=${#MODEL_IDS[@]}
    for mid in "${MODEL_IDS[@]}"; do
        local desc="${MODEL_DESCS[$((i-1))]}"
        local mark=""
        [[ "$mid" == "$current" ]] && mark="  ◀ current"
        printf "  ${BOLD}%2s${RESET}. %-44s %s%s\n" "$i" "$mid" "$desc" "$mark"
        (( i++ ))
    done
    echo ""
    printf "  ${BOLD}%2s${RESET}. Custom model ID\n" "$i"
    sep

    local choice
    while true; do
        read -rp "  Model number [1]: " choice
        choice="${choice:-1}"
        if [[ "$choice" =~ ^[0-9]+$ ]]; then
            if (( choice >= 1 && choice <= total )); then
                SELECTED_MODEL="${MODEL_IDS[$((choice-1))]}"
                break
            elif (( choice == total + 1 )); then
                read -rp "  Enter model ID: " SELECTED_MODEL
                [[ -n "$SELECTED_MODEL" ]] && break
            fi
        fi
        err "Invalid choice, enter 1–$((total+1))."
    done
    ok "Model: $SELECTED_MODEL"
}

# ─────────────────────────────────────────────────────────────────────────────
#  INSURER SELECTION
# ─────────────────────────────────────────────────────────────────────────────
select_insurer() {
    hdr "Select Insurer"
    sep
    printf "  ${BOLD}%3s${RESET}  %s\n" "0" "All insurers"
    local i=1
    for name in "${INSURER_LIST[@]}"; do
        printf "  ${BOLD}%3s${RESET}  %s\n" "$i" "$name"
        (( i++ ))
    done
    sep

    local choice
    while true; do
        read -rp "  Number or partial name [0 = all]: " choice
        choice="${choice:-0}"

        if [[ "$choice" == "0" ]]; then
            SELECTED_INSURER="ALL"
            ok "Insurer: All (${NUM_INSURERS} insurers)"
            return
        fi

        if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= NUM_INSURERS )); then
            SELECTED_INSURER="${INSURER_LIST[$((choice-1))]}"
            ok "Insurer: $SELECTED_INSURER"
            return
        fi

        # Partial name match
        for name in "${INSURER_LIST[@]}"; do
            local lower_name lower_choice
            lower_name=$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')
            lower_choice=$(printf '%s' "$choice" | tr '[:upper:]' '[:lower:]')
            if [[ "$lower_name" == *"$lower_choice"* ]]; then
                SELECTED_INSURER="$name"
                ok "Insurer: $SELECTED_INSURER"
                return
            fi
        done

        err "No match for '$choice'. Try a number or partial name."
    done
}

# ─────────────────────────────────────────────────────────────────────────────
#  CATEGORY SELECTION
# ─────────────────────────────────────────────────────────────────────────────
select_category() {
    hdr "Select Category"
    sep
    printf "  ${BOLD}1${RESET}  All categories\n"
    printf "  ${BOLD}2${RESET}  claims             — Claims/*.md → claims.json\n"
    printf "  ${BOLD}3${RESET}  policies_services  — Policies and services/*.md → policies_services.json\n"
    printf "  ${BOLD}4${RESET}  policy_docs        — Cleaned Notes/*.md → policy_docs/*.json\n"
    sep

    local choice
    while true; do
        read -rp "  Category [1]: " choice
        choice="${choice:-1}"
        case "$choice" in
            1) SELECTED_CATEGORY="";                ok "Category: All";               break ;;
            2) SELECTED_CATEGORY="claims";           ok "Category: claims";            break ;;
            3) SELECTED_CATEGORY="policies_services";ok "Category: policies_services"; break ;;
            4) SELECTED_CATEGORY="policy_docs";      ok "Category: policy_docs";       break ;;
            *) err "Enter 1–4." ;;
        esac
    done

    hdr "LLM Summarization"
    sep
    dim "  Generates 1-line AI summary per section for better search."
    dim "  Requires API credits on OpenRouter. Skip to use content snippets (free)."
    echo ""
    local sum_choice
    read -rp "  Enable LLM summarization? [y/N]: " sum_choice
    case "${sum_choice}" in
        y|Y) USE_SUMMARIZE=true;  ok "LLM summarization: enabled" ;;
        *)   USE_SUMMARIZE=false; ok "LLM summarization: disabled (using snippets)" ;;
    esac
}

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIRM & RUN
# ─────────────────────────────────────────────────────────────────────────────
confirm_and_run() {
    # Determine if this is a local model run
    local is_local=false
    local active_base="${OPENAI_BASE_URL:-https://openrouter.ai/api/v1}"
    if [[ "$SELECTED_MODEL" == "gemma-4-12b-it" ]]; then
        is_local=true
        active_base="${LOCAL_INDEX_URL:-http://10.10.116.160:11632/v1}"
    fi

    if [[ "$is_local" == "false" && -z "$API_KEY" ]]; then
        err "No API key found. Set OPENROUTER_API_KEY in .env (required for cloud models)"
        exit 1
    fi

    hdr "Confirm"
    sep
    echo ""
    printf "  ${BOLD}Insurer  :${RESET} %s\n" "$SELECTED_INSURER"
    printf "  ${BOLD}Category :${RESET} %s\n" "${SELECTED_CATEGORY:-all}"
    printf "  ${BOLD}Model    :${RESET} %s\n" "$SELECTED_MODEL"
    printf "  ${BOLD}API Base :${RESET} %s\n" "$active_base"
    printf "  ${BOLD}Summarize:${RESET} %s\n" "${USE_SUMMARIZE:-false}"
    echo ""
    dim "  Already-indexed files are skipped automatically."
    echo ""

    local confirm
    read -rp "  Start indexing? [y/N]: " confirm
    case "${confirm}" in
        y|Y|yes|YES);;
        *)
            echo ""
            dim "Cancelled."
            exit 0
            ;;
    esac

    hdr "Running Indexer"
    sep

    export OPENROUTER_API_KEY="$API_KEY"
    export OPENAI_API_KEY="$API_KEY"
    export OPENAI_BASE_URL="$active_base"
    export INDEX_MODEL="$SELECTED_MODEL"
    export INDEX_MODEL_URL="$active_base"

    local cmd_args=(-m indexer.build_index)
    [[ "$SELECTED_INSURER" != "ALL" ]] && cmd_args+=(--insurer "$SELECTED_INSURER")
    [[ -n "${SELECTED_CATEGORY:-}" ]]  && cmd_args+=(--category "$SELECTED_CATEGORY")
    [[ "${USE_SUMMARIZE:-false}" == "true" ]] && cmd_args+=(--summarize)

    printf "\n  ${DIM}$ python3 %s${RESET}\n\n" "${cmd_args[*]}"

    cd "$SCRIPT_DIR"
    python3 "${cmd_args[@]}"

    echo ""
    ok "Indexing complete."
}

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────
clear
echo ""
printf "  ${BOLD}StobaeusDocx Indexer${RESET}\n"
dim "  Insurance policy tree builder — local vllm / OpenRouter"
echo ""

print_status
select_insurer
select_model
select_category
confirm_and_run
