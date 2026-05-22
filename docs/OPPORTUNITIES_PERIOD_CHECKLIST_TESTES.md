# OPP-R2.1 — Checklist de Testes: Período de validade

## Pré-requisito
Execute o script SQL antes de testar:
```
scripts/INCREMENTAL_OPPORTUNITIES_PERIOD.sql
```

---

## 1. Criar oportunidade com período

| # | Ação | Resultado esperado |
|---|------|-------------------|
| 1.1 | Criar opp sem preencher Início/Fim | Salva com `starts_at = NULL`, `ends_at = NULL` |
| 1.2 | Criar opp com Início = amanhã, sem Fim | Salva e badge mostra **🕐 Programada** na listagem |
| 1.3 | Criar opp sem Início, com Fim = daqui 7 dias | Salva e badge mostra **🟢 Vigente** |
| 1.4 | Criar opp com Início < Fim | Salva normalmente |
| 1.5 | Criar opp com Início > Fim | Retorna erro: "O início deve ser anterior ao fim." |
| 1.6 | Criar opp com Início = Fim (mesmo timestamp) | Retorna erro (starts_at >= ends_at) |

---

## 2. Editar oportunidade — período preenchido corretamente

| # | Ação | Resultado esperado |
|---|------|-------------------|
| 2.1 | Abrir edição de opp com período salvo | Campos datetime-local mostram a data/hora UTC correta |
| 2.2 | Limpar Início e Fim na edição | Salva com `NULL` em ambos; badge → **∞ Sem período** |
| 2.3 | Alterar Início para data passada | Badge muda para **🟢 Vigente** |
| 2.4 | Alterar Fim para data passada | Badge muda para **⛔ Expirada** |

---

## 3. Listagem admin — badges e filtros

| # | Ação | Resultado esperado |
|---|------|-------------------|
| 3.1 | Listar opps sem filtro de período | Todas aparecem com seu badge correto |
| 3.2 | Filtrar por **🟢 Vigente** | Apenas opps onde starts_at <= agora (ou null) e ends_at >= agora (ou null) e pelo menos um dos dois é não-null |
| 3.3 | Filtrar por **🕐 Programada** | Apenas opps onde starts_at > agora |
| 3.4 | Filtrar por **⛔ Expirada** | Apenas opps onde ends_at < agora |
| 3.5 | Filtrar por **∞ Sem período** | Apenas opps onde starts_at IS NULL e ends_at IS NULL |
| 3.6 | Combinar filtro Período + Tipo | Ambos filtros aplicados simultaneamente |
| 3.7 | Card de opp com período mostra datas | Linha "Posição X · de YYYY-MM-DD HH:MM UTC até YYYY-MM-DD HH:MM UTC" |

---

## 4. Página pública /[unitSlug]/oportunidades

| # | Ação | Resultado esperado |
|---|------|-------------------|
| 4.1 | Opp com starts_at = amanhã | NÃO aparece para o lead |
| 4.2 | Opp com ends_at = ontem | NÃO aparece para o lead |
| 4.3 | Opp com starts_at = ontem e ends_at = amanhã | Aparece normalmente |
| 4.4 | Opp com starts_at = NULL e ends_at = NULL | Aparece normalmente (sem restrição) |
| 4.5 | Opps expiradas → fallback não é afetado | Fallback sempre aparece independente de período |

---

## 5. Painel do lead /[unitSlug]/painel

| # | Ação | Resultado esperado |
|---|------|-------------------|
| 5.1 | Opp em destaque com ends_at = ontem | NÃO aparece no painel; usa fallback por sonho |
| 5.2 | Opp em destaque com starts_at = amanhã | NÃO aparece no painel; usa fallback por sonho |
| 5.3 | Opp em destaque vigente | Aparece normalmente no painel |

---

## 6. Timezone (UTC)

| # | Cenário | Resultado esperado |
|---|---------|-------------------|
| 6.1 | Admin digita "13:00" no campo UTC | Sistema interpreta como 13:00 UTC (= 10:00 BRT) |
| 6.2 | Para exibir às 10h BRT → digitar 13:00 no campo | Correto — campo é UTC, não BRT |
| 6.3 | Banco armazena como TIMESTAMPTZ | Verificar via SELECT: campo deve ser `2024-XX-XXTXX:XX:00+00` |

---

## 7. Idempotência da migração SQL

| # | Ação | Resultado esperado |
|---|------|-------------------|
| 7.1 | Executar `INCREMENTAL_OPPORTUNITIES_PERIOD.sql` duas vezes | Sem erro (IF NOT EXISTS) |
| 7.2 | Opps existentes antes da migração | `starts_at = NULL`, `ends_at = NULL` → continuam aparecendo normalmente |
