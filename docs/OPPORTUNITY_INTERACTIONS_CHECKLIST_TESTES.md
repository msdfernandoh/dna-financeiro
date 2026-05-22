# Checklist de Testes — Opportunity Interactions (OPP-R3)

## Pré-requisito

- [ ] SQL incremental executado no Supabase: `scripts/INCREMENTAL_OPPORTUNITY_INTERACTIONS.sql`
- [ ] Deploy ou `npm run dev` rodando
- [ ] Lead logado em `/sinop/painel` (cookie `dna_lead_token` válido)
- [ ] Pelo menos uma oportunidade real ativa em `/admin/oportunidades`

---

## 1. SQL e estrutura

- [ ] Tabela `opportunity_interactions` existe no banco
- [ ] Colunas: `id`, `unit_id`, `lead_id`, `opportunity_id`, `opportunity_type`, `opportunity_title`, `interaction_type`, `source`, `target_dream`, `metadata`, `created_at`
- [ ] Constraints: `interaction_type IN (...)` e `source IN (...)` funcionam
- [ ] RLS habilitada na tabela
- [ ] Índices criados (`idx_oi_lead_id`, `idx_oi_unit_id`, etc.)

---

## 2. Oportunidades reais — `/sinop/oportunidades`

- [ ] Abrir a página como lead logado
- [ ] Clicar "Tenho interesse" em oportunidade real (sem URL)
  - [ ] Botão muda para verde com `✓ Tenho interesse`
  - [ ] Registro aparece no banco: `interaction_type = 'interest'`, `source = 'oportunidades'`, `opportunity_id = <uuid>`
- [ ] Clicar novamente em "Tenho interesse" na mesma opp
  - [ ] Botão não muda (já marcado como interessado)
  - [ ] **Não** grava novo registro (deduplica por sessão)
- [ ] Clicar o bookmark (salvar)
  - [ ] Ícone muda para amber
  - [ ] Registro: `interaction_type = 'save'`, `source = 'oportunidades'`
- [ ] Clicar o bookmark novamente (unsave)
  - [ ] Ícone volta ao normal
  - [ ] Registro: `interaction_type = 'unsave'`
- [ ] Se opp tiver URL externa: clicar o botão CTA
  - [ ] Navega para URL
  - [ ] Registro: `interaction_type = 'click'`, `source = 'oportunidades'`

---

## 3. Fallback — `/sinop/oportunidades`

- [ ] Desativar todas as oportunidades reais da unidade (ou acessar unidade sem opps reais)
- [ ] Clicar "Tenho interesse" em card de fallback
  - [ ] Registro aparece no banco: `opportunity_id IS NULL`, `source = 'fallback'`
  - [ ] `opportunity_title` = título do fallback exibido

---

## 4. Painel — `/sinop/painel`

- [ ] Abrir painel como lead logado
- [ ] Card "Oportunidade para você" exibe o título da opp em destaque (ou fallback)
- [ ] Clicar "Tenho interesse"
  - [ ] Botão muda para `✓ Interesse registrado`
  - [ ] Opp real: `interaction_type = 'interest'`, `source = 'painel'`, `opportunity_id = <uuid>`
  - [ ] Fallback: `interaction_type = 'interest'`, `source = 'fallback'`, `opportunity_id IS NULL`
  - [ ] `metadata.from = 'painel_featured'`
- [ ] Clicar "Ver todas →" → navega para `/sinop/oportunidades` normalmente

---

## 5. Segurança

- [ ] **Sem cookie**: `POST /api/sinop/opportunities/interactions` retorna `401`
- [ ] **`unit_id` no body**: ignorado — `unit_id` no banco deve ser o do lead, não o do body
- [ ] **`lead_id` no body**: ignorado — `lead_id` no banco deve ser o do cookie
- [ ] **`opportunity_id` de outra unidade**: retorna `400 "Oportunidade inválida ou de outra unidade"`
- [ ] **`interaction_type` inválido**: retorna `400`
- [ ] **`source` inválido**: retorna `400`
- [ ] **`metadata` > 1 KB**: ignorado (substituído por `{}`)
- [ ] **Lead de outra unidade** (cookie de sinop em request para outra unit): retorna `404`

---

## 6. Admin — contadores

- [ ] Acessar `/admin/oportunidades` como admin
- [ ] Após interações acima, os cards de opp mostram:
  - [ ] `✋ N interesse(s)` quando há interações do tipo `interest`
  - [ ] `🔗 N clique(s)` quando há interações do tipo `click`
- [ ] Se não houver interações, contadores não aparecem (sem ruído visual)

---

## 7. Verificações de integridade

- [ ] DNA não foi alterado
- [ ] Fallback de oportunidades não foi alterado
- [ ] WhatsApp não é disparado
- [ ] `/sinop/oportunidades` ainda exibe oportunidades normalmente
- [ ] `/sinop/painel` ainda carrega normalmente
- [ ] Admin de oportunidades ainda funciona (criar, editar, deletar, toggle)
