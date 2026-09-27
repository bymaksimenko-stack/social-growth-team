#!/usr/bin/env python3
"""Structural completeness validator for the social growth agent team."""

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]

SKILLS = {
    "social-producer",
    "audience-researcher",
    "marketing-strategist",
    "smm-strategist",
    "social-copywriter",
    "reels-scriptwriter",
    "visual-producer",
    "brand-guardian",
    "social-analyst",
}

REQUIRED_SKILL_CONCEPTS = (
    "## Миссия",
    "контекст",
    "## Процесс",
    "## Формат результата",
    "## Quality Gate",
    "пример",
    "стоп-услов",
)

REQUIRED_PROJECT_FILES = (
    "AGENTS.md",
    "START_HERE.md",
    "THIRD_PARTY_NOTICES.md",
    "contracts/task-handoff.md",
    "contracts/content-card.md",
    "contracts/quality-rubric.md",
    "knowledge/brand-brief.md",
    "knowledge/product.md",
    "knowledge/audience.md",
    "knowledge/voice.md",
    "knowledge/evidence.md",
    "knowledge/strategy.md",
    "operations/content-calendar.md",
    "operations/content-registry.md",
    "operations/decisions.md",
    "operations/feedback-log.md",
    "operations/analytics.md",
    "tests/scenarios/acceptance.md",
    "tests/evaluation-scorecard.md",
    "tests/audit-report.md",
    "tests/forward-test-results.md",
)


def validate() -> list[str]:
    errors: list[str] = []

    for relative in REQUIRED_PROJECT_FILES:
        if not (ROOT / relative).is_file():
            errors.append(f"missing project file: {relative}")

    skill_root = ROOT / ".agents" / "skills"
    if not skill_root.is_dir():
        errors.append("missing skill root: .agents/skills")
        discovered: set[str] = set()
    else:
        discovered = {path.name for path in skill_root.iterdir() if path.is_dir()}
    for missing in sorted(SKILLS - discovered):
        errors.append(f"missing skill directory: {missing}")
    for unexpected in sorted(discovered - SKILLS):
        errors.append(f"unexpected skill directory: {unexpected}")

    for name in sorted(SKILLS):
        skill_file = skill_root / name / "SKILL.md"
        if not skill_file.is_file():
            errors.append(f"missing SKILL.md: {name}")
            continue
        text = skill_file.read_text(encoding="utf-8")
        frontmatter = re.match(r"\A---\n(.*?)\n---\n", text, re.DOTALL)
        if not frontmatter:
            errors.append(f"invalid frontmatter: {name}")
        else:
            header = frontmatter.group(1)
            if f"name: {name}" not in header:
                errors.append(f"frontmatter name mismatch: {name}")
            if "description:" not in header:
                errors.append(f"missing description: {name}")
        folded = text.casefold()
        for concept in REQUIRED_SKILL_CONCEPTS:
            if concept.casefold() not in folded:
                errors.append(f"{name}: missing concept {concept!r}")

    agents_file = ROOT / "AGENTS.md"
    if agents_file.is_file():
        agents = agents_file.read_text(encoding="utf-8")
        for name in SKILLS:
            if name not in agents:
                errors.append(f"AGENTS.md does not route to {name}")

    content_card = ROOT / "contracts" / "content-card.md"
    if content_card.is_file():
        schema = content_card.read_text(encoding="utf-8")
        for field in ("guardian_iteration:", "guardian_reviews:", "confirmed_at:", "evidence_ref:"):
            if field not in schema:
                errors.append(f"content card missing field: {field}")

    guardian = skill_root / "brand-guardian" / "SKILL.md"
    if guardian.is_file():
        rules = guardian.read_text(encoding="utf-8")
        for transition in ("PASS_TO_USER", "REVISION_REQUIRED", "ESCALATE", "revision_required"):
            if transition not in rules:
                errors.append(f"brand guardian missing transition: {transition}")

    return errors


if __name__ == "__main__":
    failures = validate()
    if failures:
        print("VALIDATION FAILED")
        for failure in failures:
            print(f"- {failure}")
        sys.exit(1)
    print(f"STRUCTURAL VALIDATION PASSED: {len(SKILLS)} skills and {len(REQUIRED_PROJECT_FILES)} project files")
