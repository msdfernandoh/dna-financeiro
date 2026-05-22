# Opportunity Interactions — DNA Financeiro

## Visão geral

Registra cada interação de um lead com uma oportunidade exibida no app público.
Permite ao admin acompanhar interesse real e cliques por oportunidade.

---

## Tabela: `public.opportunity_interactions`

| Coluna              | Tipo        | Obrigatório | Descrição |
|---------------------|-------------|-------------|-----------|
| `id`                | UUID        | ✓           | PK gerada automaticamente |
| `unit_id`           | UUID        | ✓           | Unidade — resolvida server-side, nunca do client |
| `lead_id`           | UUID        | ✓           | Lead — resolvido do cookie `dna_lead_token` |
| `opportunity_id`    | UUID        | —           | NULL quando fallback; UUID quando opp real do banco |
| `opportunity_type`  | TEXT        | —           | `event`, `course`, `challenge`, `job`, `banner`, `partner` |
| `opportunity_title` | TEXT        | ✓           | Título exibido ao lead (inclui fallback) |
| `interaction_type`  | TEXT        | ✓           | Ver abaixo |
| `source`            | TEXT        | ✓           | Ver abaixo |
| `target_dream`      | TEXT        | —           | Sonho alvo da oportunidade |
| `metadata`          | JSONB       | ✓ `{}`      | Dados extras opcionais (max 1 KB) |
| `created_at`        | TIMESTAMPTZ | ✓           | Data/hora UTC da interação |

### `interaction_type`

| Valor      | Significado |
|------------|-------------|
| `interest` | Lead clicou "Tenho interesse" (sem URL externa) |
| `click`    | Lead clicou CTA com URL externa |
| `save`     | Lead salvou a oportunidade (bookmark) |
| `unsave`   | Lead removeu dos salvos |
| `view`     | Reservado para uso futuro (não registrado nesta fase) |

### `source`

| Valor          | Origem |
|----------------|--------|
| `oportunidades`| Página `/[unitSlug]/oportunidades` — opp real |
| `painel`       | Card de destaque em `/[unitSlug]/painel` — opp real |
| `fallback`     | Opp de fallback (não existe no banco — `opportunity_id` = NULL) |

---

## API

### `POST /api/[unitSlug]/opportunities/interactions`

**Autenticação:** cookie HttpOnly `dna_lead_token` — obrigatório.

**Body JSON:**

```json
{
  "opportunity_id":    "uuid | null",
  "opportunity_type":  "course | event | challenge | job | banner | partner | null",
  "opportunity_title": "Título da oportunidade",
  "interaction_type":  "interest | save | unsave | click",
  "source":            "painel | oportunidades | fallback",
  "target_dream":      "carro | casa | ... | null",
  "metadata":          {}
}
```

**Validações aplicadas:**

- `unit_id` e `lead_id` jamais vêm do body — resolvidos do cookie + banco
- `opportunity_id` validado: pertence à mesma unidade, `active = true`, `deleted_at IS NULL`
- `interaction_type` e `source` validados contra lista fixa
- `opportunity_title` máx. 300 chars
- `metadata` máx. 1 KB
- Lead de outra unidade → 404

**Respostas:**

| Status | Situação |
|--------|----------|
| 201    | Interação registrada |
| 400    | Campo inválido ou `opportunity_id` de outra unidade |
| 401    | Cookie ausente ou inválido |
| 404    | Lead não encontrado |
| 500    | Erro interno |

---

## Segurança

- **`unit_id` e `lead_id` nunca aceitos do body** — resolvidos exclusivamente pelo servidor via cookie `dna_lead_token`
- Cross-unit: `unit_slug` da URL é validado contra `lead.unit_slug` do banco
- `opportunity_id` externo é validado: deve pertencer à unidade do lead e estar ativo
- Fallback: `opportunity_id = null` — aceito explicitamente, sem lookup no banco
- Escrita feita via `service_role` (bypassa RLS)
- RLS habilitada: anon não lê nem escreve diretamente
- `authenticated` tem política de negação explícita para INSERT

---

## Como consultar interessados

```sql
-- Total de interessados por oportunidade (últimos 30 dias)
SELECT
  o.title,
  COUNT(oi.id) AS total_interesse,
  COUNT(DISTINCT oi.lead_id) AS leads_unicos
FROM public.opportunity_interactions oi
JOIN public.opportunities o ON o.id = oi.opportunity_id
WHERE oi.interaction_type = 'interest'
  AND oi.created_at >= NOW() - INTERVAL '30 days'
GROUP BY o.id, o.title
ORDER BY total_interesse DESC;

-- Todos os leads interessados em uma oportunidade
SELECT
  l.name, l.phone, l.email,
  oi.created_at, oi.source
FROM public.opportunity_interactions oi
JOIN public.leads l ON l.id = oi.lead_id
WHERE oi.opportunity_id = '<uuid-da-oportunidade>'
  AND oi.interaction_type = 'interest'
ORDER BY oi.created_at DESC;

-- Interações de fallback (sem opp real)
SELECT source, COUNT(*) AS total
FROM public.opportunity_interactions
WHERE opportunity_id IS NULL
GROUP BY source;
```

---

## Limitações desta fase (OPP-R3)

- `view` não é registrado (não há detalhamento individual de opp)
- Múltiplos `interest` do mesmo lead na mesma opp são registrados como histórico
- Não há tela de admin dedicada — contadores simples aparecem na listagem
- Relatório completo previsto para OPP-R4
