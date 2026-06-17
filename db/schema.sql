-- StobaeusDocx — PostgreSQL schema (v2)
-- Run: psql $DATABASE_URL -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Insurers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurers (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL UNIQUE,
    slug       TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Cases (central table — denormalized for fast queries) ─────────────────────
CREATE TABLE IF NOT EXISTS cases (
    id            TEXT        PRIMARY KEY,    -- CS-2025-001
    session_id    TEXT,                       -- OCR session UUID

    -- Patient (from OCR)
    patient_name    TEXT,
    patient_age     INT,
    patient_gender  TEXT,
    treating_doctor TEXT,
    department      TEXT,

    -- Insurer (denormalized — no JOIN needed for lists)
    insurer_name  TEXT,
    insurer_slug  TEXT,

    -- Policy
    plan_name     TEXT,
    policy_number TEXT,
    tpa_name      TEXT,
    sum_insured   TEXT,

    -- Admission
    admission_date  DATE,
    discharge_date  DATE,

    -- Diagnosis / procedures (arrays from OCR)
    diagnosis   TEXT[],
    procedures  TEXT[],

    -- Verdict
    verdict           TEXT        NOT NULL DEFAULT 'UNKNOWN'
                      CHECK (verdict IN ('APPROVABLE','PARTIAL','REJECTED','UNKNOWN')),
    verdict_reason    TEXT,
    summary_paragraph TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_verdict    ON cases(verdict);
CREATE INDEX IF NOT EXISTS idx_cases_insurer    ON cases(insurer_slug);
CREATE INDEX IF NOT EXISTS idx_cases_created    ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_session    ON cases(session_id);

-- ── ICD codes per case ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_icd_codes (
    id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id          TEXT    NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    code             TEXT    NOT NULL,
    description      TEXT,
    scheme_covered   BOOLEAN NOT NULL DEFAULT FALSE,
    restriction_note TEXT,
    sort_order       INT     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_icd_case ON case_icd_codes(case_id);

-- ── Missing items ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_missing_items (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     TEXT    NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    description TEXT    NOT NULL,
    sort_order  INT     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_missing_case ON case_missing_items(case_id);

-- ── Retrieved policy sections ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_retrieved_sections (
    id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id       TEXT    NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    section_title TEXT,
    sort_order    INT     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sections_case ON case_retrieved_sections(case_id);

-- ── Index status (track tree_index/ build state) ──────────────────────────────
CREATE TABLE IF NOT EXISTS index_status (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    insurer_name TEXT        NOT NULL,
    insurer_slug TEXT        NOT NULL,
    category     TEXT        NOT NULL
                 CHECK (category IN ('policy_docs','claims','policies_services')),
    source_file  TEXT,
    tree_path    TEXT,
    status       TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','indexed','failed')),
    model_used   TEXT,
    indexed_at   TIMESTAMPTZ,
    error_message TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_index_status_unique
    ON index_status (insurer_slug, category, COALESCE(source_file, '__agg__'));

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cases_updated_at ON cases;
CREATE TRIGGER trg_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
