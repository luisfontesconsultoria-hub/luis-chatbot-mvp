# Atualização de scoring — 28/08/2026

Esta rodada aplica as melhorias identificadas na revisão do projeto:

- CNPJ verificado: +10 (antes +3).
- Nome da empresa: +6 (antes +3).
- Status QUALIFIED: 85 pontos-base (antes 55), alinhado ao limiar de prioridade.

O armazenamento persistente da sessão do WhatsApp não é aplicado nesta rodada porque o serviço atual está no plano Free do Render e o disco persistente exige plano pago. A alteração de `render.yaml` deve ser feita junto da migração para um plano compatível, evitando quebrar o deploy atual.
