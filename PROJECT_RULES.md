# Projeto SDR / Chat-IA — Regras de Engenharia

## Escopo da V1

A V1 deve manter exatamente esta estrutura:

- Chat/IA
- SDR comercial
- Supabase
- 1 único WhatsApp (o número atual do projeto)
- preparação para Meta Ads
- preparação para Google Ads

## Regra de expansão

Nenhum segundo, terceiro ou quarto WhatsApp será integrado durante desenvolvimento, testes ou validação da V1.

Os novos chips/números só entram depois que todo o processo estiver 100% rodando, validado e estável.

## Diretrizes comerciais preservadas

- qualificação comercial;
- consulta de CNPJ por ferramenta autorizada;
- preservação de contexto;
- registro estruturado no Supabase;
- estado AGUARDANDO_RETORNO_DO_LUIS;
- escalada para atendimento humano;
- não inventar informações;
- crédito e produtos sujeitos à análise não devem ser prometidos como aprovados;
- manter o fluxo comercial já aprovado salvo solicitação expressa.

## Diretriz de custo

Priorizar implementação com custo zero, usando recursos gratuitos, open source e free tiers sempre que tecnicamente viável.

Nenhuma contratação paga deve ser adicionada automaticamente.

## Segurança

- Nunca colocar chave de API no front-end.
- Nunca colocar segredo no prompt.
- Chaves devem permanecer em ambiente seguro do backend.
- Credenciais expostas devem ser revogadas/substituídas.
- O agente não pode fabricar resultados de CNPJ, crédito, tarifas ou disponibilidade.

## Ordem de implementação

1. estabilizar o fluxo local;
2. estruturar o estado do SDR;
3. preparar integração segura com Supabase;
4. preparar integração com IA;
5. integrar somente o WhatsApp atual;
6. testar ponta a ponta;
7. corrigir bugs;
8. validar operação real de baixo volume;
9. finalizar V1;
10. somente depois iniciar expansão para novos WhatsApps.
