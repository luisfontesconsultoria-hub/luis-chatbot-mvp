# Assistente Comercial — Extensão funcional

## Objetivo
Adicionar ao núcleo V1 capacidades de inteligência comercial sem quebrar o contrato existente: score determinístico, resumo de lead, eventos para agenda/visitas e planejamento inicial de rota.

## Princípios
- Supabase continua sendo a fonte persistente.
- Nenhuma chave ou credencial fica no front-end.
- A IA não fabrica fatos críticos.
- O WhatsApp permanece único na V1.
- Rotas/visitas são módulo complementar do CRM, não substituto do pipeline.
- Rotas usam dados explícitos do lead; nenhuma distância, trânsito ou duração real é inventada.
- Planejamento de rota é auxiliar e não altera automaticamente compromissos.
- Compromissos são registrados como eventos idempotentes; a confirmação externa de calendário só existe quando houver integração real.

## Score
O score é determinístico e pode ser recalculado. Considera estágio comercial, CNPJ, empresa, faturamento, dor, interesse e próxima ação. O resultado é exposto como `assistantScore` e `assistantPriority` sem alteração obrigatória do schema de leads.

## Agenda e visitas
- `GET /api/crm/leads/:id/events` — histórico do lead.
- `POST /api/crm/appointments/rank` — filtra e prioriza janelas explicitamente fornecidas.
- `POST /api/crm/appointments` — registra um compromisso interno como evento.
- `POST /api/crm/routes/plan` — ordena paradas por prioridade e tempo de deslocamento já informado.
- Uma rota pode ser associada a um lead/evento para auditoria, mas não cria confirmação externa.

## Limite V1
Somente o WhatsApp atual pode ser conectado ou usado pelo painel. A expansão para outros números permanece bloqueada até a conclusão e validação da V1.

## Segurança e dados externos
Consulta de CNPJ continua dependente das credenciais oficiais do servidor. O front-end nunca recebe segredos. O sistema não deve inventar CNPJ, disponibilidade, distância, trânsito, tarifas, geocodificação ou confirmação de agenda.

## Próxima camada
Quando houver provedor e credenciais apropriados, adicionar calendário e geocodificação/rotas reais atrás de adapters separados. Esses adapters devem preservar o contrato interno e continuar permitindo fallback determinístico quando o serviço externo estiver indisponível.
