# DNA Financeiro — Política de Privacidade Operacional
**Documento interno para orientar o desenvolvimento**  
**Referência legal:** Lei Geral de Proteção de Dados — Lei nº 13.709/2018  
**Versão:** 1.0 · Maio 2026  
**Público:** time de produto, desenvolvimento e operações

---

## Princípio central

O DNA Financeiro coleta dados pessoais e financeiros com uma única finalidade declarada ao usuário: **gerar um diagnóstico financeiro personalizado e apresentar oportunidades relevantes para que ele realize seus sonhos**.

Nenhum dado coletado pode ser usado para finalidade diferente desta sem novo consentimento explícito. Isso não é só obrigação legal — é a base de confiança do produto.

---

## 1. Dados visíveis para o próprio usuário

O usuário tem acesso irrestrito a tudo que ele mesmo forneceu e a tudo que o sistema calculou sobre ele. Nenhuma informação sua pode ser escondida dele.

### O que ele vê no app

**Dados cadastrais**
- Nome completo
- Telefone
- E-mail (se fornecido)
- Cidade

**Dados financeiros declarados**
- Renda mensal informada
- Despesas mensais informadas
- Todas as despesas lançadas (valor, categoria, data, método de lançamento)
- Sonhos cadastrados com valor, progresso e prazo estimado

**Diagnóstico gerado pela IA**
- Perfil financeiro (ex: "Em evolução")
- Sobra mensal calculada
- Taxa de poupança
- Prazo estimado para cada sonho
- Recomendações geradas (ex: "Com R$ 300 extras por mês você chega em 2,5 anos")
- Ponto de atenção (ex: "Despesas representam 80% da renda")

**Histórico e progresso**
- Progresso do DNA (etapas concluídas)
- Conquistas desbloqueadas com data
- Pontos acumulados
- Respostas dadas nas perguntas do dia

**Origem das oportunidades**
- O usuário vê quais oportunidades foram apresentadas a ele
- Não vê por que foi segmentado para aquela oportunidade (algoritmo interno)

### Direitos garantidos ao usuário

Em conformidade com o Art. 18 da LGPD, o usuário pode a qualquer momento:

- **Acessar** todos os seus dados (tela de perfil do app)
- **Corrigir** dados incorretos (edição no perfil)
- **Excluir** sua conta e todos os dados associados (solicitação via e-mail ou botão no perfil — MVP 2)
- **Revogar** o consentimento — ao fazer isso, os dados são anonimizados e o acesso ao app é encerrado
- **Exportar** seus dados em formato legível (MVP 2)
- **Saber** com quem os dados são compartilhados (resposta: apenas com o consultor da unidade onde se cadastrou, em forma resumida)

---

## 2. Dados usados pela IA

A IA do DNA Financeiro usa os seguintes dados para gerar o diagnóstico e as recomendações. Nenhum dado identificador é enviado para modelos externos — apenas dados financeiros estruturados e anonimizados.

### Dados usados no diagnóstico

| Dado | Como é usado |
|---|---|
| Renda mensal | Calcular sobra, taxa de poupança, limite diário |
| Despesas mensais | Calcular percentual comprometido, ponto de atenção |
| Sonho principal + valor | Calcular prazo com poupança atual e com renda extra |
| Despesas lançadas por categoria | Identificar categoria mais pesada, gerar insight pós-lançamento |
| Progresso do DNA | Determinar qual nível de recomendação apresentar |
| Respostas às perguntas do dia | Refinar o perfil ao longo do tempo |

### O que a IA NÃO usa

- Nome completo
- Telefone
- E-mail
- Cidade (apenas estado para segmentação futura)
- UUID do lead
- Qualquer informação que permita identificar a pessoa individualmente

### Regra de desenvolvimento

Toda chamada à IA (Claude API ou qualquer modelo externo) deve receber apenas dados estruturados sem identificadores. O Route Handler é responsável por separar os dados antes de montar o payload. Nunca enviar o objeto `lead` completo para a IA.

### Exemplo de payload correto para a IA

```
{
  monthly_income: 3500,
  monthly_expenses: 2800,
  main_dream: "carro",
  dream_target_amount: 25000,
  saved_amount: 6500,
  top_expense_category: "alimentacao",
  top_expense_percentage: 38,
  dna_stage: 3
}
```

---

## 3. Dados resumidos visíveis para o admin da unidade

O consultor/admin da unidade enxerga dados suficientes para **contatar o lead, entender seu perfil e oferecer ajuda relevante**. Não enxerga detalhes que não contribuem para esse objetivo.

### O que o admin da unidade VÊ

**Identificação básica**
- Nome completo
- Telefone
- E-mail (se fornecido)
- Cidade

**Perfil financeiro resumido**
- Faixa de renda (não o valor exato): Até R$ 2k / R$ 2k–4k / R$ 4k–7k / Acima de R$ 7k
- Sonho principal (ex: "Carro próprio")
- Progresso do DNA em percentual (ex: 42%)
- Status do lead (novo, em andamento, qualificado, convertido)
- Data de cadastro
- Campanha de origem (ex: "Casa Própria — Jun 2026")
- Origem da URL (ex: "/sinop/casa-propria")

**Engajamento**
- Última vez que acessou o app
- Número de despesas lançadas (não os valores individuais)
- Conquistas desbloqueadas (apenas o nome, não os pontos)

### O que o admin da unidade NÃO VÊ

- Valor exato de renda e despesas (apenas a faixa)
- Despesas individuais lançadas (valor, categoria, descrição)
- Respostas às perguntas do dia
- Dados de outras unidades (isolamento total por `unit_id`)
- UUID interno do lead
- Qualquer dado coletado que não tenha finalidade para o atendimento

### Justificativa

O admin da unidade é um consultor financeiro ou responsável comercial, não um analista de dados. Ele precisa saber que o lead quer comprar um carro e tem renda entre R$ 2k e R$ 4k. Ele não precisa saber que o lead gasta R$ 92 em terças-feiras em alimentação.

---

## 4. Dados visíveis apenas para o admin master

O admin master tem acesso a dados que nenhuma unidade deve ter individualmente — para fins de operação, segurança e melhoria do produto.

### O que só o master vê

**Dados técnicos de rastreamento**
- `source_url` completa (URL exata do acesso)
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `referrer` (site de origem)
- `device_type`
- IP de acesso (apenas para fins de segurança e rate limiting — não armazenado no lead)

**Dados financeiros completos** (para análise de produto, não para uso comercial)
- Renda e despesas exatas de todos os leads
- Despesas individuais lançadas (agregadas por categoria e período — não por lead individual)
- Distribuição de sonhos e metas por região

**Logs de auditoria**
- Todas as ações dos admins de unidade
- Tentativas de acesso não autorizado
- Exportações realizadas

**Dados cross-unidade**
- Comparação de desempenho entre unidades
- Qualquer relatório consolidado

### Responsabilidade do master

O admin master assina internamente um Acordo de Confidencialidade e Uso Responsável de Dados. O acesso a dados financeiros individuais é para fins de suporte técnico e melhoria do produto — nunca para compartilhar com terceiros ou unidades.

---

## 5. Dados que nunca devem ser expostos para consultores

Esta seção é uma lista de restrições absolutas. Qualquer violação é um bug de segurança e potencialmente uma infração à LGPD.

| Dado | Por que nunca expor |
|---|---|
| Valor exato de renda e despesas mensais | Dado sensível — exposição pode causar constrangimento ou discriminação |
| Despesas individuais lançadas | Dado de comportamento financeiro — extremamente privado |
| Respostas às perguntas do dia | Podem revelar situações delicadas (ex: "Qual dívida mais tira seu sono?") |
| UUID do lead | Dado técnico — exposição permite correlação com outros sistemas |
| Dados de outras unidades | Isolamento absoluto — consultor de Sinop nunca vê leads de Sorriso |
| Foto do comprovante | Dado sensível — pode conter dados bancários completos |
| Dados coletados via voz | Se implementado com transcrição, o texto transcrito é privado |
| E-mail do lead | Só visível se o lead forneceu e consentiu explicitamente |
| Histórico de conquistas com timestamps | Revela padrão de uso e horários do usuário |
| Score de propensão da IA | Dado interno de produto — nunca deve ser apresentado como nota ao usuário |
| Origem UTM detalhada | Dado de marketing interno — consultor não precisa saber de qual anúncio veio |

### Implementação técnica

Nenhuma dessas informações deve aparecer nos endpoints `/api/admin/leads` ou `/api/admin/leads/[id]`. O Route Handler que serve dados ao painel do admin deve ter uma função `sanitizeLeadForUnitAdmin(lead)` que remove explicitamente todos os campos da lista acima antes de retornar a resposta.

---

## 6. Consentimentos necessários no onboarding

A LGPD exige que o consentimento seja **livre, informado, inequívoco e para finalidade específica** (Art. 8º). O onboarding do DNA Financeiro deve coletar três consentimentos distintos — não todos em um checkbox.

### Consentimento 1 — Uso de dados para diagnóstico (OBRIGATÓRIO)

**Quando:** tela S2 — Cadastro, antes do botão "Continuar"

**Natureza:** obrigatório para usar o app. Sem esse consentimento, o cadastro não prossegue.

**O que cobre:**
- Coleta de nome, telefone, renda e despesas
- Uso desses dados para gerar diagnóstico financeiro personalizado
- Vinculação automática à unidade da cidade onde se cadastrou
- Compartilhamento do perfil resumido com o consultor da unidade (apenas faixa de renda e sonho principal)

**Texto do checkbox:** ver seção 7.

### Consentimento 2 — Receber comunicações e oportunidades (OPCIONAL)

**Quando:** tela S2 — Cadastro, checkbox separado e desmarcado por padrão

**Natureza:** opcional. O usuário pode usar o app sem aceitar.

**O que cobre:**
- Receber notificações do app com perguntas do dia e oportunidades
- Receber contato do consultor da unidade por WhatsApp ou telefone
- Receber e-mail com informações sobre eventos e palestras

**Importante:** marcar ou desmarcar este consentimento não afeta o acesso ao app. O campo `communication_consent` é gravado no banco e pode ser alterado pelo usuário a qualquer momento no perfil.

### Consentimento 3 — Uso de dados para melhoria do produto (OPCIONAL)

**Quando:** tela S4b — Notificações, após o diagnóstico inicial

**Natureza:** opcional. Apresentado no momento de maior engajamento (logo após ver o diagnóstico).

**O que cobre:**
- Uso de dados financeiros anonimizados e agregados para melhorar os algoritmos do DNA Financeiro
- Geração de relatórios internos de produto (sempre sem identificação individual)

**Importante:** este consentimento autoriza uso interno para melhoria do produto — não autoriza venda de dados ou compartilhamento com terceiros.

### O que NÃO precisa de consentimento separado (base legal diferente)

Alguns dados são coletados sob a base legal de **legítimo interesse** (Art. 7º, IX da LGPD) — não precisam de checkbox:

- `source_url`, `utm_*`, `referrer` — necessários para o funcionamento do sistema de unidades
- `device_type` — necessário para otimizar a experiência mobile
- Logs de auditoria de ações do admin — necessários para segurança do sistema

---

## 7. Textos para checkbox de aceite

### Checkbox 1 — Uso de dados para diagnóstico (obrigatório)

> Li e concordo com a [Política de Privacidade](#) e autorizo o DNA Financeiro a usar meus dados financeiros para gerar meu diagnóstico e apresentar oportunidades relevantes para o meu perfil.

**Nota de UX:** a palavra "Política de Privacidade" deve ser um link que abre um modal ou página com o texto completo em linguagem acessível. Não pode abrir uma nova aba no meio do cadastro.

### Checkbox 2 — Comunicações (opcional, desmarcado por padrão)

> Quero receber dicas, oportunidades e notificações personalizadas pelo app e aceito ser contactado pelo consultor da minha unidade.

**Nota de UX:** exibir abaixo do checkbox: "Você pode desativar isso a qualquer momento no seu perfil."

### Checkbox 3 — Melhoria do produto (opcional, tela S4b)

> Aceito que meus dados financeiros, sem identificação pessoal, sejam usados para melhorar as recomendações do DNA Financeiro.

**Nota de UX:** exibir em tom conversacional: "Isso nos ajuda a dar diagnósticos melhores para todos. Não vendemos seus dados para ninguém."

---

## 8. Textos amigáveis explicando por que pedimos cada dado

Esses textos devem aparecer como microcopy abaixo de cada campo no cadastro e nas etapas do DNA. Tom: humano, direto e honesto — como um consultor explicaria pessoalmente.

### Por que pedimos seu nome e telefone

> Para que o consultor da sua cidade possa te contatar quando surgir uma oportunidade relevante para você. Seu telefone nunca é compartilhado com anunciantes.

### Por que pedimos sua renda mensal

> Com sua renda, conseguimos calcular quanto você pode guardar por mês e estimar em quanto tempo você realiza seu sonho. Não precisamos do valor exato — uma estimativa já é suficiente.

### Por que pedimos suas despesas mensais

> Para descobrir qual percentual da sua renda está comprometido e onde existem oportunidades de economizar. Essa é a base do seu diagnóstico financeiro.

### Por que perguntamos sobre seu sonho principal

> Seu sonho é o destino. Sem saber para onde você quer ir, não conseguimos traçar o caminho. Com ele, calculamos o prazo real e as ações que fazem sentido para você especificamente.

### Por que pedimos sobre dívidas (etapa 2 do DNA)

> Dívidas impactam diretamente sua capacidade de guardar dinheiro. Com essa informação, conseguimos incluir um plano de quitação no seu diagnóstico — e não apenas ignorar esse peso.

### Por que pedimos sobre moradia e veículo (etapa 2 do DNA)

> Aluguel e financiamento são geralmente os maiores compromissos do orçamento. Saber se você paga aluguel, por exemplo, muda completamente a estratégia para a meta de casa própria.

### Por que perguntamos sobre habilidades e disponibilidade (etapa 5 do DNA)

> Se você quiser aumentar sua renda, precisamos saber o que você sabe fazer e quando tem tempo. Assim conseguimos indicar oportunidades de diárias e serviços extras compatíveis com sua rotina.

### Por que fotografamos o comprovante (lançamento de despesa)

> Para poupar seu tempo. Em vez de digitar tudo, a IA lê o comprovante e preenche automaticamente. A foto fica armazenada de forma segura e só você tem acesso a ela.

### Texto geral sobre segurança dos dados (aparece no rodapé do cadastro)

> Seus dados são armazenados com segurança e usados apenas para gerar seu diagnóstico financeiro e apresentar oportunidades relevantes. Nunca vendemos seus dados. Você pode excluir sua conta a qualquer momento.

---

## Regras operacionais para o time de desenvolvimento

### Na construção de qualquer tela ou API

1. Antes de adicionar um novo campo de coleta, perguntar: **qual é a finalidade declarada ao usuário para esse dado?** Se não houver resposta clara, não coletar.

2. Antes de retornar dados em qualquer endpoint de admin, perguntar: **esse campo é necessário para que o consultor realize seu trabalho?** Se não, remover da resposta.

3. Qualquer dado financeiro individual (valor exato de renda, despesa por transação) só pode aparecer na tela do próprio usuário — nunca no painel do admin.

4. Toda tela nova que coleta dados deve ter o microcopy explicativo (seção 8) associado ao campo correspondente.

5. O botão de exclusão de conta deve ser implementado no MVP 2 — mas o fluxo de exclusão deve ser planejado desde o MVP 1 (quais tabelas são limpas, quais são anonimizadas, qual é o prazo).

### Prazo de retenção de dados

| Tipo de dado | Retenção após inatividade |
|---|---|
| Dados do lead ativo | Indefinido (enquanto usa o app) |
| Lead inativo (sem acesso há 24 meses) | Anonimizar automaticamente |
| Despesas individuais | 36 meses |
| Foto de comprovante | 12 meses |
| Logs de auditoria admin | 12 meses |
| UTMs e rastreamento | 24 meses |
| Dados após exclusão de conta | Excluídos em até 30 dias |

### Anonimização vs. exclusão

Quando o usuário solicitar exclusão da conta:
- Dados de identificação pessoal são apagados (nome, telefone, e-mail)
- Dados financeiros agregados são mantidos de forma anonimizada (sem vínculo com pessoa identificável) para fins estatísticos do produto
- O usuário é informado desta distinção antes de confirmar a exclusão

---

*Este documento orienta o desenvolvimento. O texto jurídico completo da Política de Privacidade pública deve ser elaborado com assessoria jurídica especializada em LGPD antes do lançamento.*
