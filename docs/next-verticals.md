# Próximos verticais: objetivos, habitação e seguros

Este incremento mantém supermercado e gastos mensais como foco. A navegação não expõe ainda estas áreas.

## Sonhos e objetivos

Modelo previsto:

- `SavingsGoal`: `id`, `userId`, `name`, `targetCents`, `savedCents`, `targetDate?`, `priority`, `createdAt`, `updatedAt`
- `GoalAllocation`: `id`, `goalId`, `savingActionId`, `amountCents`, `confirmedAt`
- `GoalScenario`: projeção não persistida que recebe um valor mensal potencial e calcula a diferença de prazo

Critérios de aceitação:

1. Nome, alvo e valor já guardado usam cêntimos inteiros; a data é opcional e a prioridade é explícita.
2. Exemplos PT-PT: fundo de emergência, férias, material escolar, obras e amortização de dívida.
3. O texto «Se libertares X EUR/mês, chegas Y meses mais cedo» é sempre rotulado como cenário, com fórmula e pressupostos visíveis.
4. Poupança potencial nunca aumenta `savedCents`. Só uma ação confirmada pode criar uma `GoalAllocation` e progresso real.
5. Uma alocação referencia uma única ação, não excede a poupança confirmada dessa ação e não pode ser contada duas vezes.
6. Sem culpa, pontos, medalhas, sequências ou linguagem infantil.

## Habitação e seguros

A taxonomia mensal deve poder acrescentar custos previsíveis sem os transformar em desperdício:

- renda ou prestação da casa
- condomínio
- seguros

Habitação entra como contexto da radiografia de custo fixo. Sem rendimento e evidência adequada, não existe classificação de «exagerado» nem estimativa de poupança. Seguros ficam preparados como contratos auditáveis por preço, renovação, coberturas e possível duplicação; até existirem esses dados, qualquer check deve aparecer como indisponível, não como recomendação.
