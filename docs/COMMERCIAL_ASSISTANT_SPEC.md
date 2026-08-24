# Assistente Comercial — Extensão funcional

## Objetivo
Adicionar ao núcleo V1 capacidades de inteligência comercial sem quebrar o contrato existente: score determinístico, resumo de lead, eventos para agenda/visitas e planejamento inicial de rota.

## Princípios
- Supabase continua sendo a fonte persistente.
- Nenhuma chave ou credencial fica no front-end.
- A IA não fabrica fatos críticos.
- O WhatsApp permanece único na V1.
- Recursos de agenda/rota usam dados explícitos do lead; nenhuma distância real é inventada.
- O planejamento de rota é uma camada auxiliar e não altera automaticamente compromissos.

## Score
O score atual é determinístico e pode ser recalculado a qualquer momento. Ele considera estágio comercial, CNPJ, empresa, faturamento, dor, interesse e próxima ação. O resultado é exposto como `assistantScore` e `assistantPriority` sem exigir alteração imediata do schema de leads.

## Endpoints internos autenticados
- `GET /api/crm/leads/:id/assistant-summary` — resumo e score.
- `GET /api/crm/leads/:id/events` — histórico de eventos.
- `POST /api/crm/appointments/rank` — ordena janelas fornecidas respeitando limites de horário.
- `POST /api/crm/routes/plan` — ordena paradas fornecidas por prioridade e tempo de deslocamento informado.

## Limite V1
Somente o WhatsApp atual pode ser conectado ou usado pelo painel. A expansão para outros números permanece bloqueada até a conclusão e validação da V1.

## Próxima camada
Integração real de calendário/geocodificação/rotas deve ser adicionada somente quando houver provedor e credenciais/configuração apropriados. O sistema não deve inventar tempo, distância, disponibilidade ou confirmação de agenda.
