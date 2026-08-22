# V1 — Testes de Aceitação

Objetivo: garantir que a simplificação preserve o comportamento comercial aprovado e evite regressões.

## A. Entrada e identificação
- [ ] cliente informa nome completo ou primeiro nome;
- [ ] variações de grafia não quebram o fluxo;
- [ ] conversa mantém o nome/contexto.

## B. Interesse comercial
- [ ] conta PJ;
- [ ] máquina de cartão;
- [ ] conta + máquina na mesma mensagem;
- [ ] pedidos sobre crédito não são tratados como aprovação;
- [ ] crédito/financiamento/consórcio/limite são direcionados para avaliação posterior após abertura da conta, conforme regra aprovada.

## C. CNPJ
- [ ] aceita CNPJ com ou sem pontuação;
- [ ] rejeita quantidade de dígitos inválida;
- [ ] valida dígitos verificadores;
- [ ] não inventa dados cadastrais;
- [ ] consulta real somente quando a ferramenta autorizada estiver integrada.

## D. Estado humano
- [ ] após consulta/necessidade de validação humana entra em AGUARDANDO_RETORNO_DO_LUIS;
- [ ] mensagens do cliente não fazem o agente avançar indevidamente;
- [ ] somente um evento autorizado de retorno pode liberar a próxima etapa;
- [ ] escalação humana preserva contexto.

## E. Qualificação
- [ ] banco atual;
- [ ] máquina atual;
- [ ] faturamento;
- [ ] dor principal: taxa, suporte, prazo ou custo;
- [ ] reunião online/presencial;
- [ ] agendamento quando a integração estiver pronta;
- [ ] confirmação da reunião.

## F. Segurança
- [ ] nenhuma chave/API secret no front-end;
- [ ] nenhuma credencial hardcoded;
- [ ] saída de ferramenta tratada como dado confiável apenas quando vier da ferramenta;
- [ ] falha de ferramenta não gera resposta inventada;
- [ ] duplicidade de lead/mensagem deve ser evitada na integração.

## G. Arquitetura
- [ ] somente 1 WhatsApp na V1;
- [ ] Supabase como estado persistente;
- [ ] IA/SDR desacoplados da interface;
- [ ] Meta Ads e Google Ads entram como aquisição/rastreamento, sem contaminar o núcleo do SDR;
- [ ] novos WhatsApps somente após V1 100% validada.

## Critério de conclusão
V1 só é considerada 100% quando os testes críticos passam, o fluxo real de baixo volume funciona de ponta a ponta e não existem bugs críticos conhecidos.
