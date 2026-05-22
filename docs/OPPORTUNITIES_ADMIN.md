# Admin de Oportunidades — Documentação

## Rotas

| Rota | Acesso | Descrição |
|------|--------|-----------|
| `/admin/oportunidades` | master, unit_admin, unit_viewer | Listagem com filtros |
| `/admin/oportunidades/nova` | master, unit_admin | Criar nova oportunidade |
| `/admin/oportunidades/[id]/editar` | master, unit_admin | Editar oportunidade existente |

---

## Roles e permissões

| Role | Listar | Criar | Editar | Ativar/Desativar | Destacar | Remover |
|------|--------|-------|--------|-----------------|---------|---------|
| `master` | Todas as units | ✅ | ✅ | ✅ | ✅ | ✅ |
| `unit_admin` | Só sua unit | ✅ | ✅ (só sua unit) | ✅ | ✅ | ✅ |
| `unit_viewer` | Só sua unit | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Campos do formulário

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `unit_id` | UUID | Master: sim | Master escolhe no select; unit_admin: fixo do token |
| `type` | enum | Sim | event / course / challenge / job / banner / partner |
| `title` | text | Sim (≥ 3 chars) | Título da oportunidade |
| `description` | text | Não | Descrição exibida ao lead |
| `cta_label` | text | Não | Texto do botão de ação |
| `cta_url` | url | Não | Link externo; sem URL → registra interesse |
| `target_dream` | enum | Não | Sonho-alvo do lead; null = exibe para todos |
| `position` | number | Não | Ordem de exibição (menor = primeiro) |
| `starts_at` | datetime-local | Não | Início da exibição (UTC) |
| `ends_at` | datetime-local | Não | Fim da exibição (UTC) |
| `featured` | checkbox | Não | Destaque no painel do lead |
| `active` | checkbox | Não | Visível para leads (default: true) |

---

## Período de validade (OPP-R2.1)

### Colunas no banco
```sql
starts_at  TIMESTAMPTZ  DEFAULT NULL   -- sem restrição de início se NULL
ends_at    TIMESTAMPTZ  DEFAULT NULL   -- sem prazo se NULL
```

### Regras de exibição pública
- `starts_at IS NULL OR starts_at <= NOW()` — início liberado
- `ends_at IS NULL OR ends_at >= NOW()` — não expirou

### Status calculado (runtime, não persistido)
| Status | Condição |
|--------|---------|
| `no-period` | starts_at = NULL **e** ends_at = NULL |
| `scheduled` | starts_at > NOW() |
| `active` | (starts_at NULL ou ≤ NOW()) **e** (ends_at NULL ou ≥ NOW()) e pelo menos um não-null |
| `expired` | ends_at < NOW() |

### Timezone
- Os campos datetime-local do formulário admin são tratados como **UTC**.
- Brasil (Brasília) = UTC−3. Para exibir às **10h BRT**, digite **13:00** no campo.
- O banco armazena como `TIMESTAMPTZ` — o valor é preservado corretamente.

---

## Segurança

- `requireAdmin()` valida o cookie `dna_admin_token` em cada ação.
- `unit_admin` **nunca** opera em opps de outra unit — toda query inclui `.eq('unit_id', session.unitId)`.
- `unit_id` na criação: master fornece via form (validado no banco); unit_admin usa o do token.
- `created_by` sempre vem de `session.profileId` — nunca do FormData.
- Soft delete: `deleted_at = NOW()` + `active = false`. Nenhum dado é apagado.

---

## Migração SQL necessária

Execute manualmente no Supabase antes de usar o período de validade:

```
scripts/INCREMENTAL_OPPORTUNITIES_PERIOD.sql
```

Script idempotente (pode ser re-executado sem efeitos colaterais).

---

## Server Actions

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| `createOpportunity` | `actions.ts` | Cria opp; valida período; resolve unit_id |
| `updateOpportunity` | `actions.ts` | Atualiza opp com proteção cross-unit |
| `toggleOppActive` | `actions.ts` | Alterna active true/false |
| `toggleOppFeatured` | `actions.ts` | Alterna featured true/false |
| `deleteOpportunity` | `actions.ts` | Soft delete (deleted_at + active=false) |
| `loginAdmin` | `login/actions.ts` | Login com e-mail/senha → cookie HttpOnly |
| `logoutAdmin` | `login/actions.ts` | Limpa cookie e redireciona |
