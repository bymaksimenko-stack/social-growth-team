# Карточка контента

```yaml
content_id: IG-YYYYMM-NNN
version: 1
status: idea
platform: instagram
format: reel|post|carousel|stories
publish_window: ""
business_goal: ""
audience_segment: ""
funnel_stage: unaware|problem_aware|solution_aware|product_aware|ready
pillar: ""
single_message: ""
product_connection: ""
source_insight: ""
evidence_refs: []
claims_allowed: []
assumptions: []
hook_variants: []
selected_hook: ""
body_or_script: ""
cta: ""
next_user_step: ""
visual_direction: ""
risks_or_unverified_claims: []
guardian_scores: {}
guardian_iteration: 0
guardian_reviews: []
revision_history: []
user_approval:
  status: pending
  confirmed_at: null
  confirmed_by: null
  evidence_ref: null
```

## Инварианты

- Одна карточка — один главный смысл.
- `evidence_refs` обязательны для цифр, кейсов, отзывов и проверяемых утверждений.
- `status: approved` допустим только при `user_approval.status: approved`, заполненных `confirmed_at`, `confirmed_by` и ссылке/цитате подтверждения в `evidence_ref`.
- После изменения устойчивого факта затронутые карточки возвращаются в `internal_review`.
- Авторские skills создают только `draft` или `internal_review`; пользовательское утверждение они не выставляют.
- `guardian_iteration` увеличивается после каждой завершённой проверки, а `guardian_reviews` хранит вердикт, оценки и дату/версию.
