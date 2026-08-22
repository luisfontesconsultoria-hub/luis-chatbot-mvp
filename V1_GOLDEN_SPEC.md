# V1 GOLDEN SPEC — SDR / CHAT-IA

## Objetivo
Levar a V1 ao uso real de baixo volume com uma base simples, segura e comercial, sem alterar as regras já aprovadas.

## Arquitetura V1
- Interface/adapter de canal: somente WhatsApp atual.
- Orquestrador backend: recebe evento, identifica lead, carrega estado, chama regras/IA/ferramentas e persiste resultado.
- SDR: conduz qualificação e próxima ação.
- IA: interpretação de linguagem e geração de resposta; não decide fatos críticos sem ferramenta/regra.
- Supabase: fonte persistente de lead, estado, mensagens, eventos e auditoria.
- Ferramenta CNPJ: consulta autorizada; resultado externo nunca é inventado.
- Humano: Luís pode assumir e liberar estados bloqueados.
- Meta Ads/Google Ads: nesta V1 ficam como camada de aquisição/atribuição preparada, sem acoplar o núcleo do SDR às campanhas.

## Estado mínimo
NEW -> IDENTIFYING -> QUALIFYING -> CNPJ_PENDING -> AGUARDANDO_RETORNO_DO_LUIS -> QUALIFYING -> ACCEPTED -> MEETING_MODE -> SCHEDULING -> CONFIRMED -> CLOSED

Estados auxiliares: HUMAN_HANDOFF, LOST, NO_RESPONSE, ERROR_RETRY.

## Regras críticas
1. Um lead deve ter identidade estável por telefone e, quando disponível, CNPJ.
2. Mensagens repetidas/eventos duplicados não podem duplicar cadastro nem avanço de etapa.
3. AGUARDANDO_RETORNO_DO_LUIS bloqueia avanço comercial automático.
4. Somente evento autorizado de retorno humano/ferramenta pode liberar o bloqueio.
5. CNPJ inválido não é enviado para consulta externa.
6. O sistema nunca inventa situação cadastral, disponibilidade, tarifa, aprovação ou crédito.
7. Crédito/financiamento/consórcio/limite e similares dependem de análise e não podem ser tratados como aprovação.
8. Falha de ferramenta gera estado de erro/retry ou handoff, nunca uma resposta factual inventada.
9. Segredos/API keys ficam somente no backend/secret store.
10. V1 possui somente um WhatsApp.

## Fluxo comercial preservado
- Nome -> interesse.
- Se o cliente informar conta + máquina juntas, reconhecer ambos e avançar diretamente para faturamento.
- Reconhecer bancos/instituições e máquinas informados em linguagem natural.
- Reconhecer faturamento numérico, k, mil/ml e milhões e manter as faixas aprovadas.
- Perguntar dor: taxa, suporte, prazo ou custo.
- Após aceite positivo, perguntar online ou presencial.
- Receber dia/data/horário, validar e confirmar agendamento quando a integração de agenda estiver disponível.
- Após CNPJ, entrar em AGUARDANDO_RETORNO_DO_LUIS até consulta/retorno autorizado.

## Persistência mínima
Tabela/coleção de leads: id, nome, telefone, empresa, cnpj, origem, campanha, produto_interesse, banco_atual, maquina_atual, faturamento, dor, status, owner, next_action, created_at, updated_at.

Mensagens: id, lead_id, channel, direction, external_message_id, text/transcript, timestamp, metadata.

Eventos: id, lead_id, type, idempotency_key, payload, created_at.

Auditoria: alterações de estado, ferramenta chamada, resultado, erro e responsável.

## Observabilidade
Registrar erros técnicos sem expor segredos. Métricas mínimas: mensagens recebidas/enviadas, leads novos, CNPJ válidos, qualificados, handoffs, agendamentos, conversões e erros.

## Critério de produção V1
- Fluxo crítico ponta a ponta testado.
- Regressões das versões aprovadas cobertas.
- Supabase persistindo estado.
- WhatsApp atual conectado.
- CNPJ integrado por ferramenta autorizada ou claramente bloqueado até integração.
- Handoff humano funcional.
- Sem segredo no cliente/front-end.
- Sem bugs críticos conhecidos.
- Piloto de baixo volume aprovado.

## Fora da V1
- novos números de WhatsApp;
- voz/telefonia automática;
- expansão omnichannel completa;
- prospecção automática ampla;
- white-label/multicliente.

Esses itens são arquitetura-alvo futura, não devem atrasar a primeira entrada em produção.
