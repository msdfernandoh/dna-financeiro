# DNA Financeiro — MVP 1

Sistema multiunidade de diagnóstico financeiro pessoal.  
**Domínio:** dnafinanceiro.app.br  
**Stack:** Next.js 15 · Supabase · Vercel · TypeScript

---

## Estrutura de arquivos criados neste PR

```
src/
├── app/
│   ├── layout.tsx                        # Layout raiz
│   ├── globals.css                       # Reset CSS global
│   ├── page.tsx                          # Raiz → redirect /sinop (dev)
│   ├── [unitSlug]/
│   │   ├── page.tsx                      # Server Component — resolve unidade
│   │   ├── RegisterForm.tsx              # Client Component — formulário
│   │   ├── actions.ts                    # Server Action — cria lead
│   │   └── diagnostico/
│   │       └── page.tsx                  # Tela de confirmação pós-cadastro
│   └── api/
│       └── leads/
│           └── session/
│               └── route.ts              # GET — verifica sessão do lead
├── lib/
│   ├── supabase/
│   │   └── server.ts                     # Cliente com service_role key
│   └── units.ts                          # resolveUnit(), resolveCampaign()
└── types/
    └── database.ts                       # Tipos TypeScript alinhados ao schema
```

---

## Setup local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha `.env.local` com os valores do seu projeto Supabase:

```bash
# Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # NUNCA expor ao browser

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Confirmar que o SQL foi executado

Verifique no Supabase SQL Editor que as queries de validação do Bloco 8 passam:

```sql
-- Deve retornar 3 unidades
SELECT id, name, slug, city FROM public.units ORDER BY city;

-- Deve retornar 12 tabelas com rls_enabled = true
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
```

### 4. Rodar o projeto

```bash
npm run dev
```

Acesse: [http://localhost:3000/sinop](http://localhost:3000/sinop)

---

## Como testar o fluxo completo

### Teste 1 — Cadastro de lead em Sinop

1. Acesse `http://localhost:3000/sinop`
2. Selecione um sonho (ex: Carro próprio)
3. Clique em "Esse é meu sonho!"
4. Preencha nome, telefone, cidade, renda e despesas
5. Marque o checkbox de consentimento
6. Clique em "Ver meu diagnóstico grátis →"
7. Você deve ser redirecionado para `/sinop/diagnostico`

### Teste 2 — Verificar lead no Supabase

No SQL Editor do Supabase:

```sql
SELECT
  id,
  name,
  phone,
  city,
  monthly_income,
  monthly_expenses,
  main_dream,
  unit_id,
  unit_slug,
  source_url,
  device_type,
  status,
  consent_diagnosis,
  consent_at,
  created_at
FROM public.leads
ORDER BY created_at DESC
LIMIT 1;
```

**Verificar:**
- `unit_id` = UUID da unidade Sinop (não `null`)
- `unit_slug` = `'sinop'`
- `source_url` contém a URL de origem
- `consent_diagnosis` = `true`
- `consent_at` não é `null`
- `status` = `'new'`

### Teste 3 — Unidade inexistente deve retornar 404

Acesse: `http://localhost:3000/unidade-que-nao-existe`  
Resultado esperado: página 404 do Next.js

### Teste 4 — unit_id nunca vai ao browser

Abra o DevTools → Network → selecione a requisição POST do formulário → Payload  
Verificar que **não existe** nenhum campo `unit_id` nem `campaign_id` no body.

### Teste 5 — Slug reservado não cai na rota dinâmica

Acesse: `http://localhost:3000/admin`  
Resultado esperado: redirect para `/` (configurado no `next.config.ts`)

### Teste 6 — Com UTMs

```
http://localhost:3000/sinop?utm_source=instagram&utm_medium=social&utm_campaign=carro
```

Após cadastro, verificar no banco:
```sql
SELECT utm_source, utm_medium, utm_campaign FROM public.leads ORDER BY created_at DESC LIMIT 1;
```
Deve retornar `instagram`, `social`, `carro`.

### Teste 7 — Campanha (quando criada no banco)

```sql
-- Inserir campanha de teste
INSERT INTO public.campaigns (unit_id, name, slug, headline, active, created_by)
SELECT id, 'Casa Própria Sinop', 'casa-propria', 'Realize o sonho da casa própria', true,
  (SELECT id FROM public.profiles LIMIT 1)  -- ajuste para um profile existente
FROM public.units WHERE slug = 'sinop';
```

Depois acesse: `http://localhost:3000/sinop/casa-propria`  
*(Requer criar a rota `/[unitSlug]/[campaignSlug]` — próximo PR)*

---

## Regras de segurança em produção

| Item | Status |
|---|---|
| `unit_id` nunca no browser | ✅ Implementado |
| `SUPABASE_SERVICE_ROLE_KEY` sem prefixo `NEXT_PUBLIC_` | ✅ Implementado |
| Slug sanitizado com regex antes de qualquer query | ✅ Implementado |
| Cookie `dna_lead_token` com HttpOnly + Secure | ✅ Implementado |
| Slugs reservados redirecionam para `/` | ✅ Implementado via `next.config.ts` |
| Headers de segurança HTTP | ✅ Implementado via `next.config.ts` |
| `notFound()` igual para "não existe" e "inativo" | ✅ Implementado |

---

## Próximos arquivos (próximo PR)

- `src/app/[unitSlug]/[campaignSlug]/page.tsx` — rota de campanha
- `src/app/[unitSlug]/diagnostico/page.tsx` — diagnóstico real com IA
- `src/app/[unitSlug]/dashboard/page.tsx` — dashboard do lead
- `src/app/api/leads/[token]/expenses/route.ts` — lançar despesa
- Middleware de proteção de rotas `/admin/*`
