# Контракт передачи задачи

Каждый специалист получает задачу от Продюсера в следующем формате.

```yaml
task_id: TASK-YYYYMMDD-NNN
owner: skill-name
requested_by: social-producer
business_goal: ""
audience_segment: ""
funnel_stage: unaware|problem_aware|solution_aware|product_aware|ready
deliverable: ""
source_files: []
confirmed_facts: []
hypotheses: []
constraints: []
deadline_or_period: ""
approval_required: true
```

## Правила

- Пустые критичные поля не заполнять догадками.
- Если неизвестное влияет на стратегию, оффер, доказательства или обещание, вернуть `BLOCKED: clarification_required` и сформулировать до трёх точных вопросов.
- Если неизвестное влияет только на второстепенный вариант исполнения, сделать обратимое предположение и явно пометить его.
- Результат должен содержать `task_id`, использованные источники, решения, открытые вопросы и следующий рекомендуемый владелец.

