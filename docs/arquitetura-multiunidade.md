# DNA Financeiro — Planejamento de Arquitetura Multiunidade
**Domínio oficial:** dnafinanceiro.app.br  
**Versão:** 1.0 — Documento técnico e estratégico  
**Data:** Maio 2026

---

## 1. Visão geral da arquitetura

O sistema opera em três camadas simultâneas:

**Camada pública** — o usuário final acessa o app via rota da unidade ou subdomínio. Nunca vê outras unidades.

**Camada de unidade** — o admin da unidade gerencia seus próprios leads, campanhas, oportunidades e relatórios. Isolamento total por `unit_id`.

**Camada master** — o admin global da Anthropic/franqueador vê todas as unidades, pode criar novas, comparar desempenho e configurar o sistema.

---

## 2. Estrutura de rotas — dnafinanceiro.app.br

### Rotas públicas (usuário final)

```
dnafinanceiro.app.br/                        → landing nacional (vitrine do produto)
dnafinanceiro.app.br/sinop                   → app completo da unidade Sinop
dnafinanceiro.app.br/sorriso                 → app completo da unidade Sorriso
dnafinanceiro.app.br/lucas-do-rio-verde      → app completo da unidade Lucas do Rio Verde
dnafinanceiro.app.br/nova-mutum              → app completo da unidade Nova Mutum
dnafinanceiro.app.br/cuiaba                  → app completo da unidade Cuiabá
```

### Rotas de campanha (dentro de cada unidade)

```
dnafinanceiro.app.br/sinop/casa-propria      → campanha Casa Própria em Sinop
dnafinanceiro.app.br/sinop/renda-extra       → campanha Renda Extra em Sinop
dnafinanceiro.app.br/sinop/servidor-publico  → campanha Servidor Público em Sinop
dnafinanceiro.app.br/sorriso/consorcio       → campanha Consórcio em Sorriso
dnafinanceiro.app.br/lucas/veiculos          → campanha Veículos em Lucas
```

Cada rota de campanha carrega:
- banner e headline personalizados da campanha
- pergunta do dia segmentada
- oportunidades filtradas por `campaign_slug`
- formulário de cadastro com `campaign_slug` pré-preenchido

### Subdomínios (futuro — unidades premium)

```
sinop.dnafinanceiro.app.br        → app completo com branding da unidade Sinop
sorriso.dnafinanceiro.app.br      → app completo com branding da unidade Sorriso
```

O subdomínio é idêntico à rota `/sinop` em funcionalidade — diferencia apenas no branding e na URL para as unidades que querem identidade própria. Resolução: o servidor detecta o subdomínio e injeta o `unit_slug = sinop` automaticamente.

### Painel administrativo

```
dnafinanceiro.app.br/admin                   → login do admin
dnafinanceiro.app.br/admin/master            → painel do admin master
dnafinanceiro.app.br/admin/sinop             → painel da unidade Sinop
dnafinanceiro.app.br/admin/sorriso           → painel da unidade Sorriso
```

---

## 3. Modelo de dados — tabelas necessárias

### Tabela: `units` (unidades)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | Identificador único |
| name | VARCHAR | Nome da unidade — "Sinop MT" |
| slug | VARCHAR UNIQUE | sinop, sorriso, lucas-do-rio-verde |
| subdomain | VARCHAR NULL | sinop (para sinop.dnafinanceiro.app.br) |
| city | VARCHAR | Nome da cidade |
| state | CHAR(2) | MT, SP, etc. |
| plan | ENUM | basic, standard, premium |
| active | BOOLEAN | Unidade ativa ou suspensa |
| logo_url | VARCHAR NULL | Logo da unidade |
| primary_color | VARCHAR NULL | Cor primária para white label |
| contact_name | VARCHAR | Nome do responsável |
| contact_email | VARCHAR | E-mail do responsável |
| contact_phone | VARCHAR | Telefone do responsável |
| created_at | TIMESTAMP | |

### Tabela: `users` (todos os usuários do sistema)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | |
| name | VARCHAR | |
| email | VARCHAR UNIQUE | |
| phone | VARCHAR | |
| password_hash | VARCHAR | |
| role | ENUM | master, unit_admin, unit_viewer, end_user |
| unit_id | UUID FK NULL | NULL se master |
| active | BOOLEAN | |
| created_at | TIMESTAMP | |

### Tabela: `leads` (usuários finais que iniciaram o cadastro)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | |
| unit_id | UUID FK | Unidade de origem — OBRIGATÓRIO |
| campaign_id | UUID FK NULL | Campanha de origem |
| name | VARCHAR | |
| phone | VARCHAR | |
| email | VARCHAR NULL | |
| city | VARCHAR | |
| monthly_income | DECIMAL | Renda declarada |
| monthly_expenses | DECIMAL | Despesas declaradas |
| main_dream | VARCHAR | Sonho principal |
| source_url | TEXT | URL completa de acesso |
| unit_slug | VARCHAR | sinop, sorriso, etc. |
| campaign_slug | VARCHAR NULL | casa-propria, renda-extra, etc. |
| utm_source | VARCHAR NULL | |
| utm_medium | VARCHAR NULL | |
| utm_campaign | VARCHAR NULL | |
| referrer | TEXT NULL | URL de origem |
| device_type | VARCHAR | mobile, tablet, desktop |
| dna_progress | SMALLINT | 0–100% |
| profile_stage | SMALLINT | Etapa do DNA 1–6 |
| status | ENUM | new, in_progress, qualified, converted, inactive |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### Tabela: `campaigns` (campanhas por unidade)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | |
| unit_id | UUID FK | |
| name | VARCHAR | "Casa Própria Sinop" |
| slug | VARCHAR | casa-propria |
| headline | TEXT | Texto da landing page |
| subheadline | TEXT | |
| banner_url | VARCHAR NULL | |
| target_profile | VARCHAR | servidor-publico, autonomo, etc. |
| active | BOOLEAN | |
| starts_at | DATE NULL | |
| ends_at | DATE NULL | |
| created_at | TIMESTAMP | |

### Tabela: `opportunities` (oportunidades por unidade)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | |
| unit_id | UUID FK | |
| campaign_id | UUID FK NULL | Se vinculada a uma campanha |
| type | ENUM | event, course, challenge, job, banner, partner |
| title | VARCHAR | |
| description | TEXT | |
| image_url | VARCHAR NULL | |
| cta_label | VARCHAR | "Reservar vaga" |
| cta_url | VARCHAR NULL | |
| target_dream | VARCHAR NULL | casa, carro, negocio, etc. |
| target_profile | VARCHAR NULL | servidor, clt, autonomo |
| active | BOOLEAN | |
| featured | BOOLEAN | Aparece em destaque |
| starts_at | TIMESTAMP NULL | |
| ends_at | TIMESTAMP NULL | |
| created_at | TIMESTAMP | |

### Tabela: `daily_questions` (pergunta do dia por unidade)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | |
| unit_id | UUID FK | |
| campaign_id | UUID FK NULL | |
| question_text | TEXT | |
| target_profile | VARCHAR NULL | aluguel, carro-financiado, devedor |
| active_date | DATE | Data de exibição |
| created_at | TIMESTAMP | |

### Tabela: `question_answers` (respostas das perguntas do dia)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | |
| lead_id | UUID FK | |
| question_id | UUID FK | |
| answer | TEXT | |
| answered_at | TIMESTAMP | |

### Tabela: `expenses` (despesas lançadas pelo usuário)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | |
| lead_id | UUID FK | |
| unit_id | UUID FK | |
| amount | DECIMAL | |
| category | VARCHAR | |
| description | VARCHAR NULL | |
| input_method | ENUM | manual, voice, photo |
| receipt_url | VARCHAR NULL | Foto do comprovante |
| ai_confidence | SMALLINT NULL | 0–100 se via IA |
| expense_date | DATE | |
| created_at | TIMESTAMP | |

### Tabela: `dreams` (sonhos e metas do usuário)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | |
| lead_id | UUID FK | |
| unit_id | UUID FK | |
| dream_type | VARCHAR | casa, carro, negocio, viagem |
| target_amount | DECIMAL | |
| saved_amount | DECIMAL | |
| monthly_contribution | DECIMAL | |
| is_primary | BOOLEAN | |
| created_at | TIMESTAMP | |

### Tabela: `achievements` (conquistas desbloqueadas por usuário)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | |
| lead_id | UUID FK | |
| unit_id | UUID FK | |
| achievement_key | VARCHAR | first_step, dream_set, control_on |
| unlocked_at | TIMESTAMP | |
| points | SMALLINT | |

### Tabela: `unit_admins` (vínculo entre usuário e unidade com role)

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | |
| user_id | UUID FK | |
| unit_id | UUID FK | |
| role | ENUM | unit_admin, unit_viewer |
| created_at | TIMESTAMP | |

---

## 4. Modelo de permissões

### Roles e acessos

| Ação | master | unit_admin | unit_viewer | end_user |
|---|---|---|---|---|
| Ver todas as unidades | ✅ | ❌ | ❌ | ❌ |
| Criar/editar unidades | ✅ | ❌ | ❌ | ❌ |
| Ver leads de qualquer unidade | ✅ | ❌ | ❌ | ❌ |
| Ver leads da própria unidade | ✅ | ✅ | ✅ | ❌ |
| Exportar leads | ✅ | ✅ | ❌ | ❌ |
| Criar campanhas | ✅ | ✅ (própria) | ❌ | ❌ |
| Criar oportunidades | ✅ | ✅ (própria) | ❌ | ❌ |
| Criar perguntas do dia | ✅ | ✅ (própria) | ❌ | ❌ |
| Ver relatórios da unidade | ✅ | ✅ | ✅ | ❌ |
| Ver relatórios consolidados | ✅ | ❌ | ❌ | ❌ |
| Gerenciar admins da unidade | ✅ | ✅ (própria) | ❌ | ❌ |
| Configurar white label | ✅ | ❌ | ❌ | ❌ |
| Ver próprio perfil/dados | — | — | — | ✅ |

### Regra de ouro do isolamento

Toda query que acessa dados sensíveis (leads, expenses, dreams, achievements, question_answers) **obrigatoriamente** inclui a cláusula `WHERE unit_id = :unit_id_do_token`. O `unit_id` é extraído do JWT no momento do login e nunca pode ser sobrescrito por parâmetros da requisição.

O admin master usa um token especial sem `unit_id` vinculado, que bypassa o filtro de unidade — mas é auditado em log separado.

---

## 5. Regras de segurança — isolamento de dados

### Regra 1 — Vínculo obrigatório no cadastro

Quando um lead faz cadastro em `dnafinanceiro.app.br/sinop`, o servidor:
1. Lê o `unit_slug` da rota
2. Busca o `unit_id` correspondente na tabela `units`
3. Grava `unit_id` e `unit_slug` no registro do lead
4. Grava `source_url` completa (incluindo UTMs se existirem)
5. Se a rota for `/sinop/casa-propria`, grava também `campaign_id` e `campaign_slug`

Nenhum campo de unidade pode vir do frontend — apenas da rota, validada no servidor.

### Regra 2 — Token com escopo

O JWT gerado no login do admin contém:
```
{ user_id, role, unit_id, unit_slug, exp }
```
Cada rota de API valida se o `unit_id` do token corresponde ao `unit_id` do recurso solicitado. Se não corresponder e o role não for `master`, retorna 403.

### Regra 3 — Sem cross-unit via API

Um admin da unidade Sinop não pode:
- Buscar leads por `lead_id` de outra unidade
- Criar campanhas para outra unidade
- Ver oportunidades de outra unidade
- Acessar `/admin/sorriso` com token de Sinop

### Regra 4 — Logs de auditoria

Toda ação do admin (criação, edição, exportação, exclusão) é registrada em tabela `audit_logs` com `user_id`, `unit_id`, `action`, `resource_type`, `resource_id` e `timestamp`. O master pode ver todos os logs.

### Regra 5 — Proteção do painel master

O painel `/admin/master` só aceita tokens com `role = master`. Qualquer tentativa de acesso com outro role retorna 403 e registra o evento em log de segurança.

---

## 6. Telas do painel — Admin Master

### Dashboard Master

- Total de leads (geral e por unidade, com gráfico de barras comparativo)
- Total de unidades ativas
- Leads novos hoje e na semana (geral)
- Unidade com maior volume de leads no período
- Unidade com maior taxa de progresso de DNA
- Alertas: unidades inativas, campanhas vencidas, unidades sem atividade há 7+ dias

### Gestão de Unidades

- Lista de todas as unidades com: nome, cidade, plano, leads totais, data de cadastro, status
- Botão "Nova unidade"
- Ao clicar em uma unidade: ver detalhes, editar dados, suspender, ver leads

### Criar / Editar Unidade

- Nome da unidade
- Slug da URL (validado como único e sem caracteres especiais)
- Subdomínio (opcional, plan premium)
- Cidade e estado
- Plano (basic, standard, premium)
- Logo
- Cor primária (white label)
- Responsável: nome, e-mail, telefone
- Botão "Criar admin da unidade" (envia convite por e-mail)

### Leads Consolidados

- Tabela com todos os leads de todas as unidades
- Filtros: unidade, campanha, período, status, sonho principal, origem
- Exportar CSV com `unit_slug` e `campaign_slug` incluídos
- Clique no lead: ver perfil completo

### Campanhas (visão global)

- Lista de todas as campanhas de todas as unidades
- Filtros: unidade, status, período
- Pode desativar campanhas de qualquer unidade

### Relatórios Consolidados

- Leads por unidade (gráfico comparativo)
- Taxa de conversão por unidade e campanha
- Distribuição de sonhos principais (geral e por unidade)
- Progresso médio do DNA por unidade
- Despesas lançadas por período e unidade
- Oportunidades com mais cliques por unidade

### Configurações do Sistema

- Gerenciar roles de admins master
- Configurar limites de unidades por plano
- Configurar campos obrigatórios do DNA
- Ver logs de auditoria global
- Configurar integrações futuras (WhatsApp, CRM, etc.)

---

## 7. Telas do painel — Admin da Unidade

O admin da unidade acessa `/admin/sinop` (ou qualquer slug da sua unidade). Nunca vê dados de outras unidades.

### Dashboard da Unidade

- Leads novos hoje, esta semana, este mês
- Leads por status: novo, em andamento, qualificado, convertido
- Gráfico de leads por dia (últimos 30 dias)
- Campanha com melhor desempenho
- Progresso médio do DNA dos leads
- Oportunidade mais clicada
- Pergunta do dia ativa

### Leads da Unidade

- Tabela com nome, telefone, sonho, status, campanha, DNA %, data de cadastro
- Filtros: campanha, status, sonho, período, origem
- Clique no lead: ver perfil completo com histórico de despesas, sonhos, respostas às perguntas, conquistas
- Exportar CSV (apenas da própria unidade)
- Marcar como: qualificado, convertido, inativo

### Campanhas da Unidade

- Lista de campanhas criadas
- Status: ativa, agendada, encerrada
- Leads por campanha
- Botão "Nova campanha"
- Criar campanha: nome, slug, headline, banner, perfil-alvo, datas

### Oportunidades da Unidade

- Lista de oportunidades cadastradas
- Tipos: evento, palestra, desafio, vaga de renda extra, banner, parceiro
- Filtros: tipo, ativo, campanha vinculada
- Botão "Nova oportunidade"
- Campos: título, descrição, imagem, CTA, sonho-alvo, perfil-alvo, datas

### Perguntas do Dia

- Calendário com perguntas agendadas por data
- Criar pergunta: texto, data, perfil-alvo, campanha (opcional)
- Ver respostas recebidas por pergunta

### Relatórios da Unidade

- Leads por semana e mês
- Taxa de progresso do DNA (médio e por faixa)
- Sonhos mais cadastrados
- Categorias de despesas mais lançadas
- Oportunidades com mais interesse
- Origem dos leads (URL, UTM source/medium, referrer)

### Configurações da Unidade

- Editar nome, telefone de contato
- Gerenciar admins da unidade (convidar outro admin ou viewer)
- Personalizar cor (se plano permitir)
- Ver logo atual

---

## 8. MVP 1 — Fundação e validação

**Objetivo:** validar o produto com 1 a 3 unidades piloto, coletar leads reais e testar o fluxo completo do usuário.

**O que entra no MVP 1:**

Infraestrutura:
- Domínio `dnafinanceiro.app.br` configurado com SSL
- Roteamento por slug de unidade (`/sinop`, `/sorriso`)
- Banco de dados com as tabelas: units, users, leads, campaigns, expenses, dreams

App do usuário final:
- Onboarding completo (boas-vindas, cadastro, sonho, diagnóstico, notificações)
- Dashboard com limite diário, sonho e pergunta do dia
- Lançamento de despesa: manual, voz e foto (simulada no MVP 1)
- DNA Financeiro com etapas 1, 2 e 3
- Tela de oportunidades (dados estáticos por unidade)
- Recompensas básicas (3 conquistas)

Painel admin (MVP 1 — simplificado):
- Login do admin
- Painel da unidade: ver leads em tabela simples
- Cadastro manual de oportunidades (texto apenas)
- Pergunta do dia: cadastro e agendamento

Rastreamento:
- Captura de `unit_id`, `unit_slug`, `campaign_slug`, `source_url`, `device_type`
- Nenhum lead pode ser gravado sem `unit_id`

**O que fica fora do MVP 1:**
- Subdomínios
- White label
- Admin master com painel visual completo
- Relatórios avançados
- Exportação de CSV
- OCR real no comprovante
- Reconhecimento de voz real
- Integração com WhatsApp

---

## 9. MVP 2 — Escala e operação

**Objetivo:** produto operacional para múltiplas unidades, com admin completo, relatórios e campanhas funcionando.

**O que entra no MVP 2:**

Painel admin completo:
- Admin master com dashboard consolidado e gestão de unidades
- Admin da unidade com todas as telas descritas na seção 7
- Criação e gestão de campanhas com landing page personalizada
- Exportação de leads em CSV com todos os campos de rastreamento
- Relatórios visuais: gráficos de leads, sonhos, DNA progress, oportunidades

App do usuário:
- DNA Financeiro completo (etapas 4, 5 e 6)
- Plano financeiro gerado pela IA com base no perfil completo
- Relatórios mensais do usuário
- Sistema de conquistas completo (todas as recompensas)
- Notificações via push (web) ou WhatsApp

Infraestrutura:
- OCR real no lançamento via foto (integração com API de visão)
- Reconhecimento de voz real (Web Speech API ou Whisper)
- Sistema de convite para novos admins de unidade (e-mail com token)
- Logs de auditoria visíveis no painel master

Rastreamento avançado:
- Captura de UTM completo (source, medium, campaign, term, content)
- Relatório de origem dos leads por canal

---

## 10. Itens futuros (pós MVP 2)

**Subdomínios e white label**
- Cada unidade premium usa `sinop.dnafinanceiro.app.br`
- Logo, cor primária e nome da unidade injetados via DNS + configuração no banco

**App de diárias integrado**
- Usuários com habilidades cadastradas recebem vagas de trabalho por unidade
- Admin da unidade cadastra vagas, sistema notifica usuários compatíveis
- Histórico de diárias realizadas no perfil do usuário

**Integração com WhatsApp Business**
- Leads recebem mensagem automática ao se cadastrar
- Admin pode enviar mensagem para leads qualificados diretamente do painel
- Pergunta do dia enviada via WhatsApp para usuários que optaram

**CRM avançado**
- Pipeline de acompanhamento: lead → qualificado → em negociação → convertido → pós-venda
- Histórico de contatos registrado por lead
- Tarefas e lembretes para o admin da unidade

**Modo franquia**
- Contrato digital de franquia assinado no próprio painel
- Royalties calculados automaticamente por volume de leads convertidos
- Painel financeiro da franquia: receitas, repasses, histórico

**Segmentação avançada de IA**
- Score de propensão do lead para cada produto (consórcio, renda extra, investimento)
- Recomendação automática de oportunidade com base no perfil completo
- Diagnóstico financeiro atualizado automaticamente conforme o usuário lança despesas

**App nativo (React Native)**
- Versão iOS e Android
- Push notifications nativas
- Câmera com OCR nativo (sem abertura de browser)
- Armazenamento local para uso offline

---

## 11. Resumo de decisões de arquitetura

| Decisão | Escolha | Justificativa |
|---|---|---|
| Isolamento de dados | `unit_id` em toda tabela + filtro obrigatório no JWT | Sem risco de vazamento entre unidades |
| Roteamento de unidade | Slug na URL, resolvido no servidor | Simples, SEO-friendly, sem JavaScript |
| Subdomínio futuro | DNS wildcard + detecção no middleware | Nenhuma mudança no banco de dados |
| Role do admin master | Role separado no JWT, sem `unit_id` | Acesso total sem bypass de segurança |
| Rastreamento de origem | Campos na tabela `leads`, gravados no momento do cadastro | Nunca depende de cookie ou sessão |
| Campanhas | Tabela separada vinculada à unidade | Admin da unidade tem autonomia total |
| White label | `primary_color` e `logo_url` na tabela `units` | Injetado via CSS variable no frontend |

