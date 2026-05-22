# DNA Financeiro — Especificação Técnica para Desenvolvimento
**Domínio:** dnafinanceiro.app.br  
**Stack:** Next.js 14 (App Router) · Supabase · Tailwind CSS · Shadcn UI  
**Versão:** 1.0 — Pronto para desenvolvimento  
**Data:** Maio 2026

---

## 1. Arquitetura geral do sistema

### Visão de camadas

```
┌─────────────────────────────────────────────────────────┐
│  CDN / Edge (Vercel Edge Network)                       │
│  Middleware: detecta unit_slug via rota ou subdomínio   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  Next.js 14 — App Router                                │
│                                                         │
│  /app                                                   │
│    /[unit_slug]          → app público da unidade       │
│    /[unit_slug]/[campaign_slug] → landing de campanha   │
│    /admin/[unit_slug]    → painel da unidade            │
│    /admin/master         → painel master                │
│    /api/...              → Route Handlers (API)         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  Supabase                                               │
│  ├── PostgreSQL (banco principal)                       │
│  ├── Auth (JWT + RLS)                                   │
│  ├── Storage (logos, banners, comprovantes)             │
│  └── Realtime (notificações futuras)                    │
└─────────────────────────────────────────────────────────┘
```

### Decisões de arquitetura

**Next.js App Router** é escolhido sobre Pages Router porque permite Server Components, que resolvem o `unit_slug` no servidor antes de renderizar qualquer HTML — o cliente nunca recebe dados de outra unidade.

**Supabase RLS (Row Level Security)** é a segunda linha de defesa. Mesmo que um bug bypasse o middleware, o banco recusa queries sem o `unit_id` correto no token.

**Middleware do Next.js** roda na Edge antes de qualquer página ser servida. É o único lugar que interpreta a rota e injeta o contexto de unidade. Nunca o componente React.

**Supabase Auth** gerencia tokens JWT. Os campos `unit_id`, `unit_slug` e `role` são adicionados ao JWT via custom claims no momento do login. O frontend lê esses valores apenas para UX (mostrar nome da unidade), nunca para decisões de segurança.

---

## 2. Estrutura de rotas públicas

### Convenção de nomenclatura

- `[unit_slug]` — parâmetro dinâmico do Next.js, ex: `sinop`, `sorriso`
- `[campaign_slug]` — ex: `casa-propria`, `renda-extra`
- Slugs usam apenas letras minúsculas, números e hífens
- Slugs são validados no banco ao criar a unidade — não podem colidir com rotas reservadas (`admin`, `api`, `auth`, `_next`)

### Tabela de rotas públicas

| Rota | Arquivo Next.js | Descrição |
|---|---|---|
| `/` | `app/page.tsx` | Landing nacional — vitrine do produto |
| `/[unit_slug]` | `app/[unit_slug]/page.tsx` | App completo da unidade |
| `/[unit_slug]/[campaign_slug]` | `app/[unit_slug]/[campaign_slug]/page.tsx` | Landing de campanha |
| `/auth/login` | `app/auth/login/page.tsx` | Login admin |
| `/auth/invite/[token]` | `app/auth/invite/[token]/page.tsx` | Aceitar convite de admin |

### Resolução de unidade no servidor

No arquivo `app/[unit_slug]/page.tsx`, a primeira operação é sempre:

```
1. Ler params.unit_slug
2. Buscar unit na tabela units WHERE slug = params.unit_slug AND active = true
3. Se não encontrar: renderizar 404
4. Se encontrar: passar unit completo para os componentes filhos via Server Component
5. NUNCA passar unit_id para o cliente — apenas dados não-sensíveis (nome, cor, logo)
```

### Rotas reservadas (bloqueadas para uso como unit_slug)

`admin`, `api`, `auth`, `_next`, `static`, `favicon`, `sitemap`, `robots`, `master`, `super`, `system`, `health`, `status`

### Subdomínio futuro

O middleware detecta `request.headers.get('host')`:
- Se for `sinop.dnafinanceiro.app.br`, extrai `sinop` e redireciona internamente para `/sinop`
- O restante do fluxo é idêntico — a lógica de unidade não muda

---

## 3. Estrutura de rotas administrativas

### Painel da unidade

| Rota | Arquivo | Acesso |
|---|---|---|
| `/admin` | `app/admin/page.tsx` | Redireciona para `/admin/[unit_slug]` do usuário logado |
| `/admin/[unit_slug]` | `app/admin/[unit_slug]/page.tsx` | Dashboard da unidade |
| `/admin/[unit_slug]/leads` | `.../leads/page.tsx` | Lista de leads |
| `/admin/[unit_slug]/leads/[id]` | `.../leads/[id]/page.tsx` | Perfil completo do lead |
| `/admin/[unit_slug]/campaigns` | `.../campaigns/page.tsx` | Lista de campanhas |
| `/admin/[unit_slug]/campaigns/new` | `.../campaigns/new/page.tsx` | Criar campanha |
| `/admin/[unit_slug]/campaigns/[id]` | `.../campaigns/[id]/page.tsx` | Editar campanha |
| `/admin/[unit_slug]/opportunities` | `.../opportunities/page.tsx` | Lista de oportunidades |
| `/admin/[unit_slug]/opportunities/new` | `.../opportunities/new/page.tsx` | Criar oportunidade |
| `/admin/[unit_slug]/questions` | `.../questions/page.tsx` | Perguntas do dia |
| `/admin/[unit_slug]/reports` | `.../reports/page.tsx` | Relatórios da unidade |
| `/admin/[unit_slug]/settings` | `.../settings/page.tsx` | Configurações da unidade |

### Painel master

| Rota | Arquivo | Acesso |
|---|---|---|
| `/admin/master` | `app/admin/master/page.tsx` | Dashboard consolidado |
| `/admin/master/units` | `.../units/page.tsx` | Todas as unidades |
| `/admin/master/units/new` | `.../units/new/page.tsx` | Criar unidade |
| `/admin/master/units/[id]` | `.../units/[id]/page.tsx` | Editar unidade |
| `/admin/master/leads` | `.../leads/page.tsx` | Leads de todas as unidades |
| `/admin/master/campaigns` | `.../campaigns/page.tsx` | Campanhas globais |
| `/admin/master/reports` | `.../reports/page.tsx` | Relatórios consolidados |
| `/admin/master/audit` | `.../audit/page.tsx` | Logs de auditoria |
| `/admin/master/admins` | `.../admins/page.tsx` | Gestão de usuários admin |

### Proteção de rotas via middleware

O middleware (`middleware.ts` na raiz) intercepta toda rota `/admin/*` e:

```
1. Verifica se existe cookie de sessão Supabase válido
2. Decodifica o JWT e extrai: role, unit_id, unit_slug
3. Se role = master: permite acesso a /admin/master e /admin/[qualquer_slug]
4. Se role = unit_admin ou unit_viewer:
   a. Extrai o [unit_slug] da URL
   b. Compara com unit_slug do token
   c. Se diferente: redireciona para /admin/[unit_slug_do_token]
5. Se não autenticado: redireciona para /auth/login?redirect=[url_atual]
```

---

## 4. Modelo de autenticação

### Provider

Supabase Auth com e-mail e senha. O fluxo de "magic link" fica para MVP 2.

### Custom claims no JWT

Ao criar um usuário admin, uma função PostgreSQL (trigger) insere os custom claims no token:

```
app_metadata: {
  role: "unit_admin",        // master | unit_admin | unit_viewer
  unit_id: "uuid-da-unidade",
  unit_slug: "sinop"
}
```

O campo `app_metadata` é controlado pelo servidor — nunca pelo cliente. O cliente pode ler `user_metadata` (nome, foto), mas não pode alterar `app_metadata`.

### Fluxo de login do admin

```
1. POST /auth/login → email + senha
2. Supabase Auth valida credenciais
3. Retorna access_token (JWT) + refresh_token
4. Next.js armazena em cookie HttpOnly (gerenciado pelo Supabase SSR helper)
5. Cookie tem flag Secure, SameSite=Lax
6. Middleware lê o cookie em cada requisição — nunca localStorage
7. Se role = unit_admin → redireciona para /admin/[unit_slug]
8. Se role = master → redireciona para /admin/master
```

### Fluxo de convite de novo admin de unidade

```
1. Admin master ou unit_admin acessa /admin/[slug]/settings
2. Insere e-mail do novo admin
3. Sistema cria registro em tabela unit_invites com token UUID e expiry (48h)
4. Envia e-mail com link: /auth/invite/[token]
5. Novo admin acessa o link, define senha
6. Sistema cria user no Supabase Auth com app_metadata corretos
7. Invalida o token de convite
```

### Sessão do usuário final (end_user)

O usuário final do app não usa Supabase Auth. Ele é identificado por `lead_id` gravado em cookie de sessão simples (não autenticado). Não há login de usuário final no MVP 1. No MVP 2, pode-se implementar auth por telefone (OTP SMS).

---

## 5. Modelo de permissões por role

### Definição dos roles

**`master`** — acesso total, sem restrição de unidade. Gerenciado internamente pela equipe do produto.

**`unit_admin`** — acesso completo a uma unidade específica. Pode criar campanhas, oportunidades, perguntas, ver e exportar leads, convidar um `unit_viewer`.

**`unit_viewer`** — acesso de leitura à unidade. Pode ver leads e relatórios, mas não criar nem editar nada.

**`end_user`** — não é um role de admin. É o usuário final do app. Não tem acesso ao painel.

### Matriz de permissões

| Recurso / Ação | master | unit_admin | unit_viewer |
|---|---|---|---|
| Listar todas as unidades | ✅ | ❌ | ❌ |
| Criar / editar unidade | ✅ | ❌ | ❌ |
| Suspender unidade | ✅ | ❌ | ❌ |
| Ver leads (própria unidade) | ✅ | ✅ | ✅ |
| Ver leads (outras unidades) | ✅ | ❌ | ❌ |
| Exportar leads | ✅ | ✅ | ❌ |
| Editar status do lead | ✅ | ✅ | ❌ |
| Criar campanha | ✅ | ✅ (própria) | ❌ |
| Editar campanha | ✅ | ✅ (própria) | ❌ |
| Criar oportunidade | ✅ | ✅ (própria) | ❌ |
| Criar pergunta do dia | ✅ | ✅ (própria) | ❌ |
| Ver relatórios (própria) | ✅ | ✅ | ✅ |
| Ver relatórios consolidados | ✅ | ❌ | ❌ |
| Convidar unit_admin | ✅ | ✅ (própria) | ❌ |
| Convidar unit_viewer | ✅ | ✅ (própria) | ❌ |
| Ver logs de auditoria | ✅ | ❌ | ❌ |
| Configurar white label | ✅ | ❌ | ❌ |

### Implementação no Next.js

Cada Server Component de rota admin chama uma função `requireRole(role_minimo, unit_slug_esperado)` que:
1. Lê a sessão do cookie
2. Verifica o role
3. Se unit_admin ou unit_viewer, verifica se o `unit_slug` da URL bate com o do token
4. Retorna o objeto `session` completo ou faz `redirect()`
5. Nunca lança exceção — sempre redireciona

---

## 6. Regras de isolamento por unit_id

### Regra 1 — Origem do unit_id

O `unit_id` **nunca** vem de:
- Parâmetro de query string (`?unit_id=...`)
- Body de requisição POST enviado pelo frontend
- localStorage ou sessionStorage
- Cookie manipulável pelo JavaScript

O `unit_id` **sempre** vem de:
- JWT do Supabase Auth (para admins)
- Resolução do `unit_slug` da URL no servidor (para o app público)

### Regra 2 — RLS no Supabase (segunda linha de defesa)

Toda tabela com dados de lead ou operação tem RLS habilitado. Exemplos de policies:

**Tabela `leads` — leitura:**
```sql
-- Unit admin só vê leads da própria unidade
CREATE POLICY "unit_admin_read_own_leads" ON leads
  FOR SELECT USING (
    unit_id = (auth.jwt() -> 'app_metadata' ->> 'unit_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
  );
```

**Tabela `leads` — inserção (pelo app público, sem auth):**
```sql
-- Inserção pública permitida — unit_id vem do servidor, não do cliente
-- O Route Handler do Next.js usa a service_role key do Supabase
-- (nunca exposta ao browser) para inserir com unit_id já validado
CREATE POLICY "service_role_insert_leads" ON leads
  FOR INSERT WITH CHECK (true); -- protegido pela service_role key
```

**Tabela `expenses`, `dreams`, `achievements`, `question_answers`:**
Mesma estrutura — leitura filtrada por `unit_id` do JWT ou `master`.

### Regra 3 — Route Handlers do Next.js

Todo Route Handler (`/api/*`) que acessa dados de unidade:

```
1. Importa createServerClient do @supabase/ssr
2. Lê session do cookie (nunca do header Authorization passado pelo cliente)
3. Extrai unit_id do JWT via session.user.app_metadata.unit_id
4. Usa esse unit_id como filtro em toda query — nunca aceita unit_id do body
5. Se a query retornar zero resultados, retorna 404 (não 403 — não revela existência)
```

### Regra 4 — Inserção de leads pelo app público

O fluxo de cadastro público (`/sinop/cadastro`) usa um Route Handler intermediário:

```
1. Cliente envia formulário sem unit_id
2. Route Handler lê params.unit_slug da URL da requisição (não do body)
3. Faz SELECT na tabela units WHERE slug = unit_slug (query com service_role)
4. Se unidade não existe ou está inativa: retorna 404
5. Injeta unit_id no objeto antes de inserir — o cliente nunca viu o unit_id
6. Grava também source_url, campaign_slug, device_type, utm_*
```

### Regra 5 — Prevenção de enumeração

As APIs de admin não retornam mensagens de erro distintas para "unidade não existe" vs "sem permissão". Ambos retornam 404. Isso impede que um admin de Sinop descubra se existe uma unidade Cuiabá testando URLs.

---

## 7. Tabelas do banco de dados

### Convenções

- Todos os IDs são `UUID` gerados com `gen_random_uuid()`
- Todos os timestamps são `TIMESTAMPTZ` (com timezone, UTC)
- Campos `deleted_at` permitem soft delete — registros não são apagados
- RLS habilitado em todas as tabelas listadas

---

### `units`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL               -- "DNA Financeiro Sinop"
slug            TEXT NOT NULL UNIQUE        -- "sinop"
subdomain       TEXT UNIQUE                 -- "sinop" (para sinop.dnafinanceiro.app.br)
city            TEXT NOT NULL
state           CHAR(2) NOT NULL
plan            TEXT NOT NULL DEFAULT 'basic'  -- basic | standard | premium
active          BOOLEAN NOT NULL DEFAULT true
logo_url        TEXT
primary_color   TEXT                        -- "#7F77DD" (white label)
contact_name    TEXT NOT NULL
contact_email   TEXT NOT NULL
contact_phone   TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
deleted_at      TIMESTAMPTZ
```

---

### `admin_users`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
auth_user_id    UUID NOT NULL UNIQUE        -- FK → auth.users.id (Supabase Auth)
unit_id         UUID REFERENCES units(id)  -- NULL se master
name            TEXT NOT NULL
email           TEXT NOT NULL
role            TEXT NOT NULL              -- master | unit_admin | unit_viewer
active          BOOLEAN NOT NULL DEFAULT true
last_login_at   TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
deleted_at      TIMESTAMPTZ
```

---

### `unit_invites`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
unit_id         UUID NOT NULL REFERENCES units(id)
invited_by      UUID NOT NULL REFERENCES admin_users(id)
email           TEXT NOT NULL
role            TEXT NOT NULL              -- unit_admin | unit_viewer
token           UUID NOT NULL DEFAULT gen_random_uuid()
expires_at      TIMESTAMPTZ NOT NULL       -- now() + interval '48 hours'
accepted_at     TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
```

---

### `leads`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
unit_id         UUID NOT NULL REFERENCES units(id)
campaign_id     UUID REFERENCES campaigns(id)

-- Dados pessoais
name            TEXT NOT NULL
phone           TEXT NOT NULL
email           TEXT
city            TEXT

-- Dados financeiros
monthly_income  NUMERIC(12,2)
monthly_expenses NUMERIC(12,2)
main_dream      TEXT                       -- casa | carro | negocio | viagem | etc.

-- Rastreamento de origem (gravados no cadastro, imutáveis depois)
source_url      TEXT NOT NULL              -- URL completa no momento do cadastro
unit_slug       TEXT NOT NULL              -- "sinop"
campaign_slug   TEXT                       -- "casa-propria" (NULL se sem campanha)
utm_source      TEXT
utm_medium      TEXT
utm_campaign    TEXT
utm_term        TEXT
utm_content     TEXT
referrer        TEXT                       -- Referer header HTTP
device_type     TEXT                       -- mobile | tablet | desktop

-- Progresso
dna_progress    SMALLINT NOT NULL DEFAULT 0  -- 0–100
dna_stage       SMALLINT NOT NULL DEFAULT 1  -- 1–6
status          TEXT NOT NULL DEFAULT 'new'  -- new | in_progress | qualified | converted | inactive

-- Controle
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
deleted_at      TIMESTAMPTZ
```

**Índices:** `idx_leads_unit_id`, `idx_leads_campaign_id`, `idx_leads_status`, `idx_leads_created_at`

---

### `campaigns`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
unit_id         UUID NOT NULL REFERENCES units(id)
name            TEXT NOT NULL              -- "Casa Própria Sinop — Jun 2026"
slug            TEXT NOT NULL              -- "casa-propria"
headline        TEXT
subheadline     TEXT
banner_url      TEXT
target_dream    TEXT                       -- casa | carro | negocio
target_profile  TEXT                       -- servidor | clt | autonomo | todos
active          BOOLEAN NOT NULL DEFAULT true
starts_at       DATE
ends_at         DATE
created_by      UUID NOT NULL REFERENCES admin_users(id)
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
deleted_at      TIMESTAMPTZ

UNIQUE (unit_id, slug)
```

---

### `opportunities`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
unit_id         UUID NOT NULL REFERENCES units(id)
campaign_id     UUID REFERENCES campaigns(id)
type            TEXT NOT NULL             -- event | course | challenge | job | banner | partner
title           TEXT NOT NULL
description     TEXT
image_url       TEXT
cta_label       TEXT NOT NULL DEFAULT 'Saiba mais'
cta_url         TEXT
target_dream    TEXT                      -- casa | carro | negocio | NULL (todos)
target_profile  TEXT                      -- servidor | clt | todos
featured        BOOLEAN NOT NULL DEFAULT false
active          BOOLEAN NOT NULL DEFAULT true
starts_at       TIMESTAMPTZ
ends_at         TIMESTAMPTZ
position        SMALLINT DEFAULT 0        -- ordem de exibição
created_by      UUID NOT NULL REFERENCES admin_users(id)
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
deleted_at      TIMESTAMPTZ
```

---

### `daily_questions`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
unit_id         UUID NOT NULL REFERENCES units(id)
campaign_id     UUID REFERENCES campaigns(id)
question_text   TEXT NOT NULL
target_profile  TEXT                      -- NULL = todos
active_date     DATE NOT NULL
created_by      UUID NOT NULL REFERENCES admin_users(id)
created_at      TIMESTAMPTZ DEFAULT now()

UNIQUE (unit_id, active_date)             -- uma pergunta por unidade por dia
```

---

### `question_answers`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
unit_id         UUID NOT NULL REFERENCES units(id)
lead_id         UUID NOT NULL REFERENCES leads(id)
question_id     UUID NOT NULL REFERENCES daily_questions(id)
answer          TEXT NOT NULL
answered_at     TIMESTAMPTZ DEFAULT now()

UNIQUE (lead_id, question_id)
```

---

### `expenses`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
unit_id         UUID NOT NULL REFERENCES units(id)
lead_id         UUID NOT NULL REFERENCES leads(id)
amount          NUMERIC(12,2) NOT NULL
category        TEXT NOT NULL             -- alimentacao | transporte | saude | lazer | moradia | compras | educacao | outros
description     TEXT
input_method    TEXT NOT NULL             -- manual | voice | photo
receipt_url     TEXT                      -- Supabase Storage path
ai_confidence   SMALLINT                  -- 0–100, preenchido apenas se input_method = photo
expense_date    DATE NOT NULL DEFAULT CURRENT_DATE
created_at      TIMESTAMPTZ DEFAULT now()
deleted_at      TIMESTAMPTZ
```

---

### `dreams`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
unit_id         UUID NOT NULL REFERENCES units(id)
lead_id         UUID NOT NULL REFERENCES leads(id)
dream_type      TEXT NOT NULL             -- casa | carro | negocio | viagem | reserva | faculdade | reforma | dividas | moto | outro
target_amount   NUMERIC(12,2) NOT NULL
saved_amount    NUMERIC(12,2) NOT NULL DEFAULT 0
monthly_contribution NUMERIC(12,2) NOT NULL DEFAULT 0
is_primary      BOOLEAN NOT NULL DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

---

### `achievements`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
unit_id         UUID NOT NULL REFERENCES units(id)
lead_id         UUID NOT NULL REFERENCES leads(id)
achievement_key TEXT NOT NULL             -- first_step | dream_set | control_on | 7_days | economy_hunter | income_radar | full_profile
points          SMALLINT NOT NULL DEFAULT 0
unlocked_at     TIMESTAMPTZ DEFAULT now()

UNIQUE (lead_id, achievement_key)
```

---

### `audit_logs`

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
admin_user_id   UUID NOT NULL REFERENCES admin_users(id)
unit_id         UUID REFERENCES units(id) -- NULL se master agindo globalmente
action          TEXT NOT NULL             -- create | update | delete | export | login | view
resource_type   TEXT NOT NULL             -- lead | campaign | opportunity | unit | admin_user
resource_id     UUID
old_data        JSONB                     -- snapshot antes da mudança
new_data        JSONB                     -- snapshot depois da mudança
ip_address      TEXT
user_agent      TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

`audit_logs` não tem RLS de leitura para unit_admin — apenas o master pode ler.

---

## 8. Relacionamentos entre tabelas

```
units
  ├── admin_users (1:N — um admin pertence a uma unidade, ou NULL se master)
  ├── unit_invites (1:N)
  ├── campaigns (1:N)
  ├── opportunities (1:N)
  ├── daily_questions (1:N)
  └── leads (1:N)
        ├── expenses (1:N)
        ├── dreams (1:N)
        ├── achievements (1:N)
        └── question_answers (1:N)
               └── daily_questions (N:1)

campaigns
  ├── leads (1:N — lead pode ter vindo de uma campanha)
  ├── opportunities (1:N — oportunidade pode estar dentro de uma campanha)
  └── daily_questions (1:N)

admin_users
  ├── campaigns.created_by (1:N)
  ├── opportunities.created_by (1:N)
  ├── daily_questions.created_by (1:N)
  ├── unit_invites.invited_by (1:N)
  └── audit_logs (1:N)
```

---

## 9. Fluxo de cadastro de lead por rota

```
Usuário acessa: dnafinanceiro.app.br/sinop/casa-propria

SERVIDOR (Next.js Server Component):
  1. params = { unit_slug: "sinop", campaign_slug: "casa-propria" }
  2. Supabase query: SELECT * FROM units WHERE slug = 'sinop' AND active = true
  3. Se não encontrar: renderiza página 404
  4. Supabase query: SELECT * FROM campaigns 
     WHERE unit_id = unit.id AND slug = 'casa-propria' AND active = true
  5. Renderiza a página com os dados da unidade e da campanha
  6. unit_id NUNCA vai para o HTML/JS do cliente

CLIENTE (formulário de cadastro):
  7. Usuário preenche: nome, telefone, renda, despesas
  8. Clica em "Começar meu diagnóstico"
  9. POST /api/leads/create
     Body: { name, phone, monthly_income, monthly_expenses, main_dream }
     Sem unit_id, sem campaign_id — o cliente não sabe esses valores

ROUTE HANDLER /api/leads/create:
  10. Lê headers da requisição: referer, user-agent
  11. Lê URL da requisição para extrair unit_slug e campaign_slug
  12. Cria cliente Supabase com service_role key (nunca exposta ao browser)
  13. SELECT units WHERE slug = unit_slug AND active = true → obtém unit_id
  14. SELECT campaigns WHERE unit_id = unit_id AND slug = campaign_slug → obtém campaign_id
  15. Captura: source_url (URL completa), device_type (do user-agent), utm_* (dos query params da URL original — enviados pelo cliente como contexto, não como identidade)
  16. INSERT INTO leads { ...dados_usuario, unit_id, campaign_id, unit_slug, campaign_slug, source_url, ... }
  17. Retorna: { lead_session_token, lead_id_criptografado } — nunca o UUID direto

CLIENTE (após criação):
  18. Armazena lead_session_token em cookie HttpOnly via Set-Cookie do servidor
  19. Redireciona para /sinop/diagnostico
  20. Em todas as próximas requisições, o cookie identifica o lead
```

---

## 10. Fluxo de campanha por unidade

```
ADMIN DA UNIDADE cria campanha:
  1. Acessa /admin/sinop/campaigns/new
  2. Preenche: nome, slug, headline, banner, perfil-alvo, datas
  3. POST /api/admin/campaigns
     (middleware já verificou que o token é de unit_admin de sinop)
  4. Route Handler extrai unit_id do JWT — nunca do body
  5. INSERT INTO campaigns { ...dados, unit_id } 

CAMPANHA FICA ATIVA:
  6. URL pública gerada: dnafinanceiro.app.br/sinop/casa-propria
  7. Landing exibe: headline da campanha, banner, formulário de cadastro
  8. Todo lead cadastrado via essa URL recebe campaign_id e campaign_slug

SEGMENTAÇÃO:
  9. Leads da campanha "casa-propria" veem oportunidades com target_dream = 'casa'
  10. Pergunta do dia pode ser filtrada por campaign_id
  11. Relatório da campanha: leads, taxa de progresso, conversões

ENCERRAMENTO:
  12. Admin define ends_at ou desativa manualmente
  13. Após ends_at, a rota /sinop/casa-propria redireciona para /sinop
  14. Leads já cadastrados mantêm campaign_id — histórico preservado
```

---

## 11. Fluxo de login do admin da unidade

```
1. Admin acessa /auth/login
2. Preenche e-mail e senha
3. POST /api/auth/login → Supabase Auth signInWithPassword
4. Supabase valida credenciais
5. Retorna session com access_token (JWT)
6. JWT contém app_metadata: { role: "unit_admin", unit_id: "uuid", unit_slug: "sinop" }
7. Next.js armazena session em cookie HttpOnly (Supabase SSR helper)
8. Middleware intercepta a resposta e lê role + unit_slug do JWT
9. Se role = unit_admin → redirect /admin/sinop
10. Se role = unit_viewer → redirect /admin/sinop (mesma rota, permissões diferentes no componente)
11. Se role = master → redirect /admin/master

PROTEÇÃO DE ROTA:
12. Admin de sinop tenta acessar /admin/sorriso manualmente
13. Middleware lê JWT: unit_slug = "sinop"
14. URL solicitada contém "sorriso" ≠ "sinop"
15. Middleware redireciona para /admin/sinop sem mensagem de erro
16. Audit log: action = "unauthorized_access_attempt", resource = "/admin/sorriso"
```

---

## 12. Fluxo do admin master

```
LOGIN:
1. Admin master acessa /auth/login com credenciais master
2. JWT retorna: app_metadata: { role: "master", unit_id: null }
3. Middleware: role = master → redireciona para /admin/master

ACESSO A DADOS:
4. Master acessa /admin/master/leads
5. Server Component chama requireRole("master")
6. Query: SELECT * FROM leads (sem filtro de unit_id) → RLS permite por ser master
7. Tabela exibe leads de todas as unidades com coluna "Unidade"

ACESSO AO PAINEL DE UMA UNIDADE ESPECÍFICA:
8. Master clica em "Ver painel da unidade Sinop"
9. Acessa /admin/sinop
10. Middleware: role = master → permite (master pode acessar qualquer unit slug)
11. Server Component detecta que é master acessando unidade de outro — registra em audit_log

CRIAR NOVA UNIDADE:
12. Master acessa /admin/master/units/new
13. Preenche: nome, slug, cidade, estado, plano, responsável
14. POST /api/admin/units → valida que slug é único e não é reservado
15. INSERT INTO units
16. Sistema envia e-mail de convite para o responsável (unit_invite)

GESTÃO DE ADMINS:
17. Master pode convidar, desativar e alterar role de qualquer admin
18. Toda ação é registrada em audit_log com old_data e new_data
```

---

## 13. APIs necessárias

### Convenção

- Todas as APIs ficam em `app/api/`
- Todas usam `createServerClient` do Supabase SSR (lê cookie, nunca header)
- Toda resposta de erro usa o mesmo formato: `{ error: { code, message } }`
- Nenhuma API expõe `unit_id` diretamente ao cliente — apenas dados derivados

### APIs públicas (sem autenticação de admin)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/leads/create` | Cadastro do lead pelo app público |
| POST | `/api/leads/[token]/expenses` | Lançar despesa (autenticado por lead_session_token) |
| POST | `/api/leads/[token]/dreams` | Salvar sonho |
| POST | `/api/leads/[token]/dna` | Salvar progresso do DNA |
| POST | `/api/leads/[token]/answers` | Responder pergunta do dia |
| GET | `/api/units/[slug]` | Dados públicos da unidade (nome, cor, logo — sem unit_id) |
| GET | `/api/units/[slug]/opportunities` | Oportunidades públicas da unidade filtradas por perfil |
| GET | `/api/units/[slug]/question` | Pergunta do dia da unidade |
| GET | `/api/units/[slug]/campaigns/[campaign_slug]` | Dados públicos da campanha |

### APIs administrativas (requerem JWT de admin)

| Método | Rota | Acesso mínimo | Descrição |
|---|---|---|---|
| GET | `/api/admin/leads` | unit_viewer | Lista leads (filtrado por unit_id do token) |
| GET | `/api/admin/leads/[id]` | unit_viewer | Perfil completo do lead |
| PATCH | `/api/admin/leads/[id]/status` | unit_admin | Atualizar status do lead |
| GET | `/api/admin/leads/export` | unit_admin | Exportar CSV |
| GET | `/api/admin/campaigns` | unit_viewer | Listar campanhas da unidade |
| POST | `/api/admin/campaigns` | unit_admin | Criar campanha |
| PATCH | `/api/admin/campaigns/[id]` | unit_admin | Editar campanha |
| DELETE | `/api/admin/campaigns/[id]` | unit_admin | Desativar campanha |
| GET | `/api/admin/opportunities` | unit_viewer | Listar oportunidades |
| POST | `/api/admin/opportunities` | unit_admin | Criar oportunidade |
| PATCH | `/api/admin/opportunities/[id]` | unit_admin | Editar oportunidade |
| GET | `/api/admin/questions` | unit_viewer | Listar perguntas do dia |
| POST | `/api/admin/questions` | unit_admin | Criar pergunta |
| GET | `/api/admin/reports/summary` | unit_viewer | Resumo da unidade |
| POST | `/api/admin/settings/invite` | unit_admin | Convidar novo admin |

### APIs exclusivas do master

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/master/units` | Listar todas as unidades |
| POST | `/api/master/units` | Criar unidade |
| PATCH | `/api/master/units/[id]` | Editar unidade |
| PATCH | `/api/master/units/[id]/status` | Ativar / suspender unidade |
| GET | `/api/master/leads` | Leads de todas as unidades |
| GET | `/api/master/reports` | Relatórios consolidados |
| GET | `/api/master/audit` | Logs de auditoria |
| GET | `/api/master/admins` | Todos os admins |
| PATCH | `/api/master/admins/[id]` | Editar role / ativar / desativar admin |

---

## 14. Componentes reutilizáveis

### Contexto de unidade

**`UnitProvider`** — Context React que recebe os dados públicos da unidade (nome, cor, logo) do Server Component e os disponibiliza para os Client Components. Nunca contém `unit_id`.

**`useUnit()`** — hook que lê o UnitProvider. Usado para aplicar cor primária e logo da unidade nos componentes visuais.

### Componentes do app público

**`DnaProgressBar`** — barra de progresso do DNA com percentual e label da etapa. Props: `progress: number`, `stage: number`.

**`DreamCard`** — card de sonho com valor guardado, faltante e barra de progresso. Props: `dream: Dream`.

**`OpportunityCard`** — card de oportunidade com imagem, badge de tipo, CTA. Props: `opportunity: Opportunity`.

**`ExpenseLauncher`** — componente de lançamento de despesa com 3 modos (manual, voz, foto). Gerencia o estado interno do fluxo e chama `/api/leads/[token]/expenses` ao confirmar.

**`DailyQuestion`** — card da pergunta do dia com botões de resposta. Chama `/api/leads/[token]/answers` ao responder.

**`AchievementToast`** — toast que aparece ao desbloquear conquista. Props: `achievement_key: string`.

### Componentes do painel admin

**`AdminShell`** — layout wrapper com sidebar, header e conteúdo. A sidebar é diferente para `unit_admin` e `master`. Props: `role`, `unit_slug`, `unit_name`.

**`LeadsTable`** — tabela de leads com filtros, paginação e ação de status. Props: `leads: Lead[]`, `onStatusChange`.

**`CampaignForm`** — formulário de criação e edição de campanha. Valida slug em tempo real via debounce.

**`OpportunityForm`** — formulário de oportunidade com upload de imagem para Supabase Storage.

**`QuestionCalendar`** — calendário com perguntas agendadas por data. Permite criar clicando em uma data vazia.

**`ReportCard`** — card de métrica com número, label, variação percentual e sparkline. Usado no dashboard.

**`UnitSelector`** — dropdown exclusivo do master para alternar entre unidades. Só renderiza se `role = master`.

**`AuditLogTable`** — tabela de logs de auditoria. Só acessível ao master.

### Componentes de layout e segurança

**`RequireAuth`** — Server Component que verifica autenticação. Se não autenticado, faz redirect para `/auth/login`.

**`RequireRole`** — Server Component que verifica role mínimo. Props: `minRole`, `unitSlug`. Se falhar, faz redirect.

**`UnitBoundary`** — wrapper que garante que todos os componentes filhos pertencem ao contexto da mesma unidade. Em ambiente de desenvolvimento, lança erro visível se `unit_id` vazar para o cliente.

---

## 15. Regras de segurança

### RS-01 — Nenhum unit_id no cliente

O `unit_id` (UUID) nunca deve aparecer em:
- HTML renderizado
- JSON retornado por APIs públicas
- Parâmetros de URL visíveis ao usuário
- localStorage, cookies acessíveis por JS

**Verificação:** inspecionar o HTML de qualquer página pública e procurar por padrão UUID. Se encontrado, é um bug de segurança.

### RS-02 — Service role key apenas no servidor

A `SUPABASE_SERVICE_ROLE_KEY` existe apenas em variável de ambiente do servidor (sem prefixo `NEXT_PUBLIC_`). Nunca exposta ao browser. O cliente usa apenas a `SUPABASE_ANON_KEY`.

### RS-03 — Validação de slug no servidor

Ao criar uma unidade, o slug é validado contra:
1. Regex: `/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/`
2. Lista de rotas reservadas
3. Unicidade no banco

Nenhuma dessas validações ocorre apenas no frontend.

### RS-04 — Rate limiting nas APIs públicas

A rota `/api/leads/create` tem rate limit de 5 requisições por IP por minuto. Implementado via middleware do Vercel ou biblioteca `@upstash/ratelimit` + Upstash Redis.

### RS-05 — CSRF

Next.js 14 com App Router não usa tokens CSRF tradicionais — o `SameSite=Lax` no cookie + verificação de `Origin` no Route Handler é suficiente. Para formulários sensíveis (login, criação de admin), verificar que `Origin` bate com `NEXT_PUBLIC_APP_URL`.

### RS-06 — Upload de arquivos

Uploads de banner e logo vão para Supabase Storage em bucket privado. O nome do arquivo é gerado pelo servidor (UUID + extensão) — nunca usa o nome original do arquivo do usuário. Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`. Tamanho máximo: 5MB.

### RS-07 — SQL Injection

O uso do cliente Supabase com queries tipadas previne SQL injection. Nunca usar `.rpc()` com strings interpoladas. Toda string do usuário passa pelo cliente Supabase, nunca por query SQL manual.

### RS-08 — Exposição de erros

Em produção, erros internos retornam apenas `{ error: { code: "internal_error", message: "Algo deu errado" } }`. O stack trace nunca vai para o cliente. Logs detalhados ficam no servidor (Vercel logs ou serviço de observabilidade).

---

## 16. Eventos de auditoria

Toda ação administrativa cria um registro em `audit_logs`. Implementado como função utilitária `createAuditLog()` chamada dentro dos Route Handlers.

### Eventos obrigatórios

| Evento | action | resource_type | old_data | new_data |
|---|---|---|---|---|
| Login com sucesso | `login` | `admin_user` | null | `{ ip, user_agent }` |
| Tentativa de acesso negado | `unauthorized_attempt` | `route` | null | `{ attempted_url }` |
| Criação de unidade | `create` | `unit` | null | snapshot da unit |
| Edição de unidade | `update` | `unit` | snapshot antes | snapshot depois |
| Suspensão de unidade | `suspend` | `unit` | `{ active: true }` | `{ active: false }` |
| Criação de campanha | `create` | `campaign` | null | snapshot |
| Edição de campanha | `update` | `campaign` | snapshot antes | snapshot depois |
| Desativação de campanha | `deactivate` | `campaign` | — | — |
| Edição de status de lead | `update` | `lead` | `{ status: antigo }` | `{ status: novo }` |
| Exportação de leads | `export` | `leads` | null | `{ count, filters }` |
| Criação de admin | `create` | `admin_user` | null | `{ email, role }` |
| Desativação de admin | `deactivate` | `admin_user` | `{ active: true }` | `{ active: false }` |
| Alteração de role | `update` | `admin_user` | `{ role: antigo }` | `{ role: novo }` |

### Retenção

Audit logs são imutáveis — sem UPDATE ou DELETE na tabela `audit_logs`. Retenção mínima de 12 meses. No MVP 1, sem retenção automática — limpeza manual se necessário.

---

## 17. Escopo do MVP 1

**Objetivo:** produto funcional com 1 a 3 unidades piloto, captando leads reais.

### Incluído no MVP 1

**Infraestrutura:**
- Projeto Next.js 14 no repositório
- Supabase configurado com todas as tabelas e RLS
- Deploy na Vercel com domínio `dnafinanceiro.app.br`
- Variáveis de ambiente configuradas (anon key, service role, URLs)
- Middleware de roteamento por unit_slug funcionando

**App público (`/[unit_slug]`):**
- Tela de boas-vindas (S1)
- Cadastro simplificado — 4 campos (S2)
- Escolha de sonho (S3)
- Diagnóstico inicial da IA (S4)
- Tela de notificações opt-in (S4b)
- Dashboard do usuário (S5)
- Lançamento de despesa — modo manual (S6m), modo voz simulado (S6v), modo foto simulado (S6pc)
- DNA Financeiro etapas 1, 2 e 3 (S9)
- Sonhos e metas (S10)
- Oportunidades (S11) — dados do banco da unidade
- Recompensas — 3 conquistas (S13)
- Relatório simples (S14)
- Perfil do usuário (S15)

**Rastreamento:**
- Captura obrigatória: `unit_id`, `unit_slug`, `campaign_slug`, `source_url`, `device_type`
- Captura opcional: `utm_source`, `utm_medium`, `utm_campaign`, `referrer`
- Nenhum lead gravado sem `unit_id`

**Painel admin (MVP 1 — essencial):**
- Login de admin
- Dashboard da unidade: contadores simples (leads hoje, semana, mês)
- Tabela de leads com: nome, telefone, sonho, status, data
- Visualização do perfil do lead
- Cadastro de oportunidade (texto + tipo)
- Cadastro de pergunta do dia
- Painel master mínimo: lista de unidades e leads totais por unidade

### Excluído do MVP 1

- Subdomínios (`sinop.dnafinanceiro.app.br`)
- White label (cor e logo por unidade)
- Criação de campanhas pelo admin (URLs de campanha funcionam, mas campanha é criada direto no banco)
- Exportação de CSV
- OCR real no comprovante
- Reconhecimento de voz real
- Notificações push ou WhatsApp
- DNA etapas 4, 5 e 6
- Painel master com gráficos e relatórios visuais
- Logs de auditoria com interface visual

---

## 18. Escopo do MVP 2

**Objetivo:** produto completo para operação com múltiplas unidades e admin autossuficiente.

### Adicionado no MVP 2

**App público:**
- DNA Financeiro etapas 4, 5 e 6
- Plano financeiro completo gerado pela IA
- Notificações push (web push ou integração WhatsApp)
- OCR real via API de visão (Google Vision ou AWS Textract)
- Reconhecimento de voz real (Web Speech API — sem custo de API)

**Painel admin completo:**
- Criação e gestão de campanhas com landing page gerada automaticamente
- Edição de oportunidades com upload de imagem
- Exportação de leads em CSV com todos os campos de rastreamento
- Relatórios visuais: gráficos de leads por semana, sonhos, DNA progress, oportunidades
- Calendário de perguntas do dia
- Convite de admins de unidade por e-mail
- Perfil completo do lead: histórico de despesas, sonhos, respostas, conquistas, linha do tempo

**Painel master:**
- Dashboard consolidado com gráficos comparativos entre unidades
- Criação de unidades via interface (sem precisar ir no banco)
- Gestão de admins com alteração de role
- Logs de auditoria com filtros e busca
- Configuração de white label por unidade (cor e logo)

**Infraestrutura:**
- Rate limiting nas APIs públicas
- White label: injeção de `primary_color` e `logo_url` via CSS variable
- Subdomínio wildcard configurado no DNS e middleware de detecção
- Backup automático configurado no Supabase

---

## 19. Ordem correta de implementação

### Fase 0 — Setup (2–3 dias)

1. Criar projeto Next.js 14 com TypeScript e App Router
2. Configurar Supabase: criar projeto, configurar Auth, habilitar RLS
3. Configurar Tailwind e Shadcn UI
4. Criar todas as tabelas com campos e índices
5. Habilitar RLS e criar as policies básicas
6. Configurar variáveis de ambiente local e Vercel
7. Configurar domínio `dnafinanceiro.app.br` na Vercel com SSL
8. Criar usuário master no Supabase Auth com custom claims

### Fase 1 — Roteamento e isolamento (2–3 dias)

9. Criar middleware de roteamento (`middleware.ts`) com detecção de unit_slug
10. Criar `requireRole()` e `requireAuth()` como Server Component helpers
11. Criar o Route Handler `/api/leads/create` com gravação de unit_id
12. Testar: acessar `/sinop` com unidade inexistente deve retornar 404
13. Testar: POST para `/api/leads/create` sem unit_slug válido deve retornar 404
14. Inserir 2 unidades de teste no banco: `sinop` e `sorriso`

### Fase 2 — App público — onboarding (4–5 dias)

15. Tela S1 — Boas-vindas com dados da unidade
16. Tela S2 — Cadastro com chamada ao `/api/leads/create`
17. Tela S3 — Escolha de sonho
18. Tela S4 — Diagnóstico (cálculo client-side no MVP 1)
19. Tela S4b — Notificações opt-in
20. Tela S5 — Dashboard
21. Criar lead_session_token e gerenciar cookie de sessão do lead

### Fase 3 — App público — funcionalidades core (5–6 dias)

22. Tela S6 — Lançamento de despesa (modo manual + simulações de voz e foto)
23. Tela S7 — Pós-despesa com insight da IA
24. Tela S8 — Meu dia com gráfico de barras
25. Tela S9 — DNA Financeiro etapas 1–3
26. Tela S10 — Sonhos e metas
27. Tela S11 — Oportunidades (lendo do banco da unidade)
28. Tela S13 — Recompensas com conquistas
29. Tela S14 — Relatório simples
30. Tela S15 — Perfil do usuário

### Fase 4 — Painel admin unidade (4–5 dias)

31. Login de admin (`/auth/login`)
32. Proteção de rotas `/admin/*` no middleware
33. Layout `AdminShell` com sidebar e header
34. Dashboard da unidade (`/admin/[slug]`)
35. Tabela de leads com filtros básicos
36. Tela de perfil do lead
37. Formulário de criação de oportunidade
38. Formulário de pergunta do dia

### Fase 5 — Painel master mínimo (2–3 dias)

39. Rota `/admin/master` com proteção de role = master
40. Lista de unidades com leads totais
41. Acesso ao painel de qualquer unidade pelo master
42. Criação de unidade direto no banco (via SQL no MVP 1 — interface na fase 7)

### Fase 6 — Testes e hardening (3–4 dias)

43. Testar isolamento: admin de Sinop não acessa dados de Sorriso
44. Testar que unit_id não aparece no HTML público
45. Testar rate limiting no endpoint de criação de lead
46. Testar fluxo completo de cadastro com `source_url`, `utm_*` gravados
47. Testar convite de admin por e-mail
48. Revisar todos os Route Handlers: nenhum aceita unit_id do body

### Fase 7 — MVP 2 (após validação do MVP 1)

49. Interface de criação de campanhas
50. Landing page dinâmica por campanha
51. Exportação CSV
52. Relatórios visuais com Recharts ou Chart.js
53. DNA etapas 4–6 e plano completo
54. OCR real e voz real
55. White label por unidade
56. Subdomínios wildcard
57. Logs de auditoria com interface

---

*Documento gerado para uso direto pelo time de desenvolvimento.*  
*Próximo passo: iniciar Fase 0 — Setup do projeto.*
