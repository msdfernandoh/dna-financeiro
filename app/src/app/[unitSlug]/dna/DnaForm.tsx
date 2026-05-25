'use client'

import { useActionState, useState, useEffect } from 'react'
import type { SaveDnaResult, DnaAnswerRecord } from '@/types/database'
import { C } from '@/app/components/ui'

// =============================================================================
// Definição das 6 etapas do DNA Financeiro
// Ícones: 🏠 💼 ⚠️ 💰 🎓 🎯
// =============================================================================

type AnswerType = 'select' | 'multiselect'

interface Option {
  value: string
  label: string
  desc?: string
}

interface Question {
  key:     string
  text:    string
  type:    AnswerType
  hint?:   string
  options: Option[]
}

interface Stage {
  key:         string
  stepNum:     number
  emoji:       string
  label:       string
  title:       string
  description: string
  questions:   Question[]
}

const DNA_STAGES: Stage[] = [
  {
    key: 'realidade', stepNum: 1, emoji: '🏠',
    label: 'Realidade',
    title: 'Sua realidade financeira',
    description: 'Vamos entender como está sua vida financeira hoje.',
    questions: [
      {
        key: 'situacao_financeira',
        text: 'Como você descreveria sua situação financeira hoje?',
        hint: 'Isso define o ponto de partida do seu diagnóstico.',
        type: 'select',
        options: [
          { value: 'tranquila',    label: '😌 Tranquila',    desc: 'Contas em dia, sem apertos' },
          { value: 'controlada',   label: '✅ Controlada',   desc: 'Equilibrada, mas exige atenção' },
          { value: 'apertada',     label: '😰 Apertada',     desc: 'Difícil cobrir tudo no mês' },
          { value: 'endividada',   label: '😟 Endividada',   desc: 'Dívidas pesando no orçamento' },
          { value: 'critica',      label: '🚨 Crítica',      desc: 'Situação muito difícil agora' },
        ],
      },
      {
        key: 'controla_gastos',
        text: 'Você costuma controlar seus gastos mensais?',
        hint: 'Quem controla os gastos, controla sua vida financeira.',
        type: 'select',
        options: [
          { value: 'sim_sempre',  label: 'Sim, sempre' },
          { value: 'as_vezes',    label: 'Às vezes' },
          { value: 'raramente',   label: 'Raramente' },
          { value: 'nao',         label: 'Não controlo' },
        ],
      },
      {
        key: 'tem_reserva',
        text: 'Você tem reserva de emergência?',
        hint: 'A reserva é a base de toda estratégia financeira sólida.',
        type: 'select',
        options: [
          { value: 'sim_suficiente',  label: 'Sim, suficiente',  desc: '6 meses ou mais de gastos' },
          { value: 'sim_pequena',     label: 'Sim, pequena',     desc: 'Menos de 3 meses' },
          { value: 'nao_mas_quero',   label: 'Não, mas quero criar' },
          { value: 'nao',             label: 'Não tenho' },
        ],
      },
    ],
  },
  {
    key: 'trabalho', stepNum: 2, emoji: '💼',
    label: 'Trabalho',
    title: 'Trabalho e renda',
    description: 'Como é sua relação com o trabalho e sua renda principal.',
    questions: [
      {
        key: 'vinculo_trabalho',
        text: 'Qual é seu vínculo de trabalho atual?',
        hint: 'Isso adapta as dicas e oportunidades ao seu tipo de renda.',
        type: 'select',
        options: [
          { value: 'clt',          label: '🏢 CLT',           desc: 'Empregado com carteira assinada' },
          { value: 'pj',           label: '📄 PJ / Prestador', desc: 'Pessoa jurídica ou prestador' },
          { value: 'autonomo',     label: '🤝 Autônomo',       desc: 'Por conta própria, sem CNPJ' },
          { value: 'empresario',   label: '🏭 Empresário',     desc: 'Sócio ou dono de negócio' },
          { value: 'desempregado', label: '🔎 Desempregado',   desc: 'Buscando oportunidades' },
          { value: 'outro',        label: '📌 Outro' },
        ],
      },
      {
        key: 'estabilidade_renda',
        text: 'Sua renda é estável ou variável?',
        hint: 'Renda estável e variável exigem estratégias diferentes.',
        type: 'select',
        options: [
          { value: 'sempre_estavel',    label: 'Sempre estável',      desc: 'Salário fixo todo mês' },
          { value: 'maioria_estavel',   label: 'Maioria estável',     desc: 'Pequenas variações' },
          { value: 'muito_variavel',    label: 'Muito variável',      desc: 'Muda bastante cada mês' },
          { value: 'sem_renda',         label: 'Sem renda no momento' },
        ],
      },
      {
        key: 'satisfacao_trabalho',
        text: 'Como você se sente no seu trabalho?',
        hint: 'Sua satisfação profissional afeta suas decisões financeiras.',
        type: 'select',
        options: [
          { value: 'muito_satisfeito',   label: '🌟 Muito satisfeito' },
          { value: 'satisfeito',         label: '😊 Satisfeito' },
          { value: 'insatisfeito',       label: '😐 Insatisfeito' },
          { value: 'muito_insatisfeito', label: '😞 Muito insatisfeito' },
        ],
      },
    ],
  },
  {
    key: 'dividas', stepNum: 3, emoji: '⚠️',
    label: 'Dívidas',
    title: 'Dívidas e compromissos',
    description: 'Entender suas dívidas é essencial para o seu diagnóstico.',
    questions: [
      {
        key: 'tem_dividas',
        text: 'Você tem dívidas ou parcelas em andamento?',
        hint: 'Essencial para calcular sua capacidade real de poupança.',
        type: 'select',
        options: [
          { value: 'nao',                   label: '✅ Não tenho dívidas' },
          { value: 'sim_consigo_pagar',      label: '😌 Sim, consigo pagar',    desc: 'Parcelas sob controle' },
          { value: 'sim_apertado',           label: '😰 Sim, está apertado',     desc: 'Parcelas pesando bastante' },
          { value: 'sim_nao_consigo_pagar',  label: '🚨 Sim, não consigo pagar', desc: 'Situação crítica' },
        ],
      },
      {
        key: 'tipo_divida',
        text: 'Que tipo de dívida você tem? (pode escolher mais de uma)',
        hint: 'Cada tipo de dívida tem uma estratégia de quitação diferente.',
        type: 'multiselect',
        options: [
          { value: 'cartao_credito',   label: 'Cartão de crédito' },
          { value: 'emprestimo',       label: 'Empréstimo pessoal' },
          { value: 'financiamento',    label: 'Financiamento' },
          { value: 'cheque_especial',  label: 'Cheque especial' },
          { value: 'consignado',       label: 'Consignado' },
          { value: 'familia_amigos',   label: 'Família / amigos' },
          { value: 'outro',            label: 'Outro' },
        ],
      },
      {
        key: 'preocupacao_divida',
        text: 'O que mais te preocupa com suas finanças?',
        hint: 'Isso guia as recomendações do seu plano de ação personalizado.',
        type: 'select',
        options: [
          { value: 'juros_altos',      label: '📈 Juros altos' },
          { value: 'prazo_longo',      label: '📅 Prazo muito longo' },
          { value: 'valor_total',      label: '💸 Valor total da dívida' },
          { value: 'nao_sei_por_onde', label: '🤯 Não sei por onde começar' },
          { value: 'nao_tenho',        label: '✅ Não tenho essa preocupação' },
        ],
      },
    ],
  },
  {
    key: 'renda_extra', stepNum: 4, emoji: '💰',
    label: 'Renda extra',
    title: 'Potencial de renda extra',
    description: 'Descobrir suas habilidades pode abrir novas oportunidades.',
    questions: [
      {
        key: 'interesse_renda_extra',
        text: 'Você tem interesse em gerar renda extra?',
        hint: 'Isso ajuda o app a mostrar oportunidades compatíveis com sua rotina.',
        type: 'select',
        options: [
          { value: 'sim_urgente',        label: '🔥 Sim, é urgente',        desc: 'Preciso agora' },
          { value: 'sim_oportunidade',   label: '✅ Sim, se aparecer',       desc: 'Aberto a oportunidades' },
          { value: 'talvez',             label: '🤔 Talvez no futuro' },
          { value: 'nao',                label: '❌ Não por enquanto' },
        ],
      },
      {
        key: 'habilidades',
        text: 'Quais são suas habilidades? (pode escolher mais de uma)',
        hint: 'Suas habilidades podem gerar renda de forma rápida e prática.',
        type: 'multiselect',
        options: [
          { value: 'culinaria',        label: '🍳 Culinária' },
          { value: 'costura_moda',     label: '🧵 Costura / moda' },
          { value: 'beleza_estetica',  label: '💅 Beleza / estética' },
          { value: 'tecnologia_ti',    label: '💻 Tecnologia / TI' },
          { value: 'design',           label: '🎨 Design' },
          { value: 'aulas_cursos',     label: '📚 Aulas / cursos' },
          { value: 'motorista',        label: '🚗 Motorista / app' },
          { value: 'entregas',         label: '📦 Entregas' },
          { value: 'artesanato',       label: '🎁 Artesanato' },
          { value: 'vendas',           label: '🛒 Vendas' },
          { value: 'outro',            label: '📌 Outro' },
        ],
      },
      {
        key: 'disponibilidade_horas',
        text: 'Quanto tempo por semana você teria para renda extra?',
        hint: 'Usamos isso para sugerir oportunidades no seu ritmo de vida.',
        type: 'select',
        options: [
          { value: 'menos_5h',     label: 'Menos de 5h' },
          { value: 'de_5_a_10h',  label: 'Entre 5h e 10h' },
          { value: 'de_10_a_20h', label: 'Entre 10h e 20h' },
          { value: 'mais_20h',    label: 'Mais de 20h' },
          { value: 'sem_tempo',   label: 'Sem tempo disponível' },
        ],
      },
    ],
  },
  {
    key: 'formacao', stepNum: 5, emoji: '🎓',
    label: 'Formação',
    title: 'Formação e desenvolvimento',
    description: 'Capacitação é um dos pilares do seu crescimento financeiro.',
    questions: [
      {
        key: 'escolaridade',
        text: 'Qual é a sua formação atual?',
        hint: 'Sua formação ajuda a calibrar as recomendações e oportunidades.',
        type: 'select',
        options: [
          { value: 'fundamental',         label: 'Ensino Fundamental' },
          { value: 'medio',               label: 'Ensino Médio' },
          { value: 'tecnico',             label: 'Técnico / Profissionalizante' },
          { value: 'superior_incompleto', label: 'Superior Incompleto' },
          { value: 'superior',            label: 'Superior Completo' },
          { value: 'pos_graduacao',       label: 'Pós-graduação ou mais' },
        ],
      },
      {
        key: 'interesse_capacitacao',
        text: 'Você tem interesse em cursos ou capacitação?',
        hint: 'Cursos certos podem ampliar sua renda e abrir novas oportunidades.',
        type: 'select',
        options: [
          { value: 'sim_gratuito',   label: '✅ Sim, gratuito',     desc: 'Prefiro cursos sem custo' },
          { value: 'sim_acessivel',  label: '📖 Sim, se acessível', desc: 'Invisto se valer a pena' },
          { value: 'talvez_futuro',  label: '🤔 Talvez no futuro' },
          { value: 'nao',            label: '❌ Não por enquanto' },
        ],
      },
      {
        key: 'area_interesse_formacao',
        text: 'Em qual área você quer se desenvolver? (pode escolher mais de uma)',
        hint: 'Vamos indicar cursos e oportunidades na sua área de interesse.',
        type: 'multiselect',
        options: [
          { value: 'financas',    label: '💰 Finanças / investimentos' },
          { value: 'tecnologia',  label: '💻 Tecnologia' },
          { value: 'marketing',   label: '📣 Marketing / vendas' },
          { value: 'gestao',      label: '📊 Gestão / negócios' },
          { value: 'saude',       label: '❤️ Saúde / bem-estar' },
          { value: 'beleza',      label: '💅 Beleza / estética' },
          { value: 'gastronomia', label: '🍽️ Gastronomia' },
          { value: 'idiomas',     label: '🌍 Idiomas' },
          { value: 'outro',       label: '📌 Outro' },
        ],
      },
    ],
  },
  {
    key: 'sonhos', stepNum: 6, emoji: '🎯',
    label: 'Sonhos',
    title: 'Seus sonhos e objetivos',
    description: 'Sonhos com prazo e foco se tornam metas reais.',
    questions: [
      {
        key: 'prazo_sonho_principal',
        text: 'Em quanto tempo você quer realizar seu sonho principal?',
        hint: 'Um prazo definido transforma sonho em meta concreta.',
        type: 'select',
        options: [
          { value: 'menos_1_ano',   label: '⚡ Menos de 1 ano',   desc: 'Urgente, quero logo' },
          { value: 'de_1_a_3_anos', label: '📅 Entre 1 e 3 anos', desc: 'Médio prazo' },
          { value: 'de_3_a_5_anos', label: '🎯 Entre 3 e 5 anos', desc: 'Longo prazo planejado' },
          { value: 'mais_5_anos',   label: '🌱 Mais de 5 anos',   desc: 'Construindo aos poucos' },
        ],
      },
      {
        key: 'barreira_principal',
        text: 'O que mais te impede de realizar seus sonhos?',
        hint: 'Identificar a barreira é o primeiro passo para superá-la.',
        type: 'select',
        options: [
          { value: 'falta_dinheiro',     label: '💸 Falta de dinheiro' },
          { value: 'dividas',            label: '💳 Dívidas' },
          { value: 'falta_disciplina',   label: '🧠 Falta de disciplina' },
          { value: 'falta_conhecimento', label: '📖 Falta de conhecimento' },
          { value: 'renda_instavel',     label: '📉 Renda instável' },
          { value: 'falta_tempo',        label: '⏰ Falta de tempo' },
        ],
      },
      {
        key: 'comprometimento_financeiro',
        text: 'O quanto você está comprometido com sua saúde financeira?',
        hint: 'Quanto mais comprometido, mais certeiro fica seu plano de ação.',
        type: 'select',
        options: [
          { value: 'muito',         label: '🔥 Muito comprometido', desc: 'Prioridade máxima' },
          { value: 'moderado',      label: '✅ Moderadamente',      desc: 'Fazendo o possível' },
          { value: 'pouco',         label: '🌱 Ainda pouco',        desc: 'Quero evoluir' },
          { value: 'preciso_ajuda', label: '🙋 Preciso de ajuda',   desc: 'Não sei por onde começar' },
        ],
      },
    ],
  },
]

// =============================================================================
// Props
// =============================================================================

interface Props {
  unitSlug:         string
  initialStage:     number   // 1–6
  existingAnswers:  DnaAnswerRecord[]
  leadDnaStage:     number
  showSavedBanner?: boolean
  saveDnaAction:    (prev: SaveDnaResult | null, fd: FormData) => Promise<SaveDnaResult>
}

// =============================================================================
// Componente principal
// =============================================================================

export function DnaForm({
  unitSlug, initialStage, existingAnswers, leadDnaStage, showSavedBanner, saveDnaAction,
}: Props) {
  const [state, formAction, isPending] = useActionState(saveDnaAction, null)

  // Índice base-0 do stage ativo
  const [activeIdx, setActiveIdx] = useState<number>(initialStage - 1)

  // Mapa de respostas: question_key → valor (string)
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const a of existingAnswers) map[a.question_key] = a.answer
    return map
  })

  // Sincroniza quando o servidor redireciona para nova etapa
  useEffect(() => {
    setActiveIdx(initialStage - 1)
  }, [initialStage])

  const stage   = DNA_STAGES[activeIdx]
  const stepNum = activeIdx + 1

  // Quantas etapas têm pelo menos 1 resposta?
  function stageHasAnswer(s: Stage) {
    return s.questions.some(q => answers[q.key])
  }

  // Helpers de seleção
  function selectAnswer(key: string, value: string) {
    setAnswers(prev => ({ ...prev, [key]: prev[key] === value ? '' : value }))
  }

  function toggleMulti(key: string, value: string) {
    setAnswers(prev => {
      const current = (prev[key] ?? '').split(',').filter(Boolean)
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [key]: next.join(',') }
    })
  }

  const completedCount = DNA_STAGES.filter(stageHasAnswer).length

  return (
    <>
      {/* ── Banner de etapa salva (PARTE D) ── */}
      {showSavedBanner && (
        <div style={{
          background: C.greenBg, borderRadius: 14,
          border: `1px solid ${C.green}30`,
          padding: '12px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>✅</span>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: C.greenDark }}>
              Seu DNA ficou mais inteligente!
            </p>
            <p style={{ margin: 0, fontSize: 11, color: C.greenDark, lineHeight: 1.4, opacity: 0.85 }}>
              Continue para receber dicas cada vez mais personalizadas.
            </p>
          </div>
        </div>
      )}

      {/* ── Trilha de etapas (PARTE B) ── */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16,
        paddingBottom: 6, scrollbarWidth: 'none',
      }}>
        {DNA_STAGES.map((s, i) => {
          const isActive    = activeIdx === i
          const isCompleted = stageHasAnswer(s)
          const isLocked    = !isActive && !isCompleted

          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveIdx(i)}
              style={{
                flexShrink: 0, position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '10px 12px', minWidth: 62,
                border: isActive
                  ? `2px solid ${C.purple}`
                  : isCompleted
                    ? `1.5px solid ${C.green}50`
                    : `1.5px solid ${C.border}`,
                borderRadius: 14,
                cursor: 'pointer',
                background: isActive ? C.purple : isCompleted ? C.greenBg : '#fff',
                fontFamily: 'inherit',
                transition: 'all .18s',
              }}
            >
              {/* Badge de concluído */}
              {isCompleted && !isActive && (
                <span style={{
                  position: 'absolute', top: -7, right: -7,
                  width: 17, height: 17, borderRadius: '50%',
                  background: C.green, color: '#fff',
                  fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #fff', lineHeight: 1,
                }}>✓</span>
              )}

              <span style={{ fontSize: 20, lineHeight: 1 }}>{s.emoji}</span>

              <span style={{
                fontSize: 10, fontWeight: isActive || isCompleted ? 700 : 400,
                color: isActive ? '#fff' : isCompleted ? C.greenDark : C.textSec,
                whiteSpace: 'nowrap', lineHeight: 1.2,
              }}>
                {s.label}
              </span>

              <span style={{
                fontSize: 9, lineHeight: 1,
                color: isActive
                  ? 'rgba(255,255,255,0.75)'
                  : isCompleted
                    ? C.green
                    : C.textTer,
              }}>
                {isActive ? '▶ Agora' : isCompleted ? 'Feito ✓' : `Etapa ${i + 1}`}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Card da etapa ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.purpleBg} 0%, #fff 100%)`,
        borderRadius: 16, padding: '16px',
        marginBottom: 16, display: 'flex', gap: 14, alignItems: 'flex-start',
        border: `0.5px solid ${C.purple}20`,
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: 14, background: C.purple, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          boxShadow: `0 4px 16px ${C.purple}30`,
        }}>
          {stage.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.purpleDeep }}>
              {stage.title}
            </p>
            <span style={{
              fontSize: 10, fontWeight: 600, color: C.textSec,
              background: 'rgba(0,0,0,.07)', borderRadius: 99, padding: '2px 7px',
              flexShrink: 0,
            }}>
              {stepNum}/6
            </span>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>
            {stage.description}
          </p>
          {/* Mini barra de progresso interno */}
          <div style={{ display: 'flex', gap: 3 }}>
            {DNA_STAGES.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 99,
                background: i < stepNum
                  ? (i === activeIdx ? C.purple : C.green)
                  : C.bgSecondary,
                transition: 'background .3s',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulário ── */}
      <form action={formAction} noValidate>
        {/* Campos de controle */}
        <input type="hidden" name="step_key" value={stage.key} />
        <input type="hidden" name="step_num" value={String(stepNum)} />

        {/* Campos de resposta */}
        {stage.questions.map(q => (
          <input key={`q_${q.key}`}  type="hidden" name={`q_${q.key}`}  value={answers[q.key] ?? ''} />
        ))}
        {stage.questions.map(q => (
          <input key={`qt_${q.key}`} type="hidden" name={`qt_${q.key}`} value={q.text} />
        ))}
        {stage.questions.map(q => (
          <input key={`at_${q.key}`} type="hidden" name={`at_${q.key}`} value={q.type} />
        ))}

        {/* ── Perguntas (PARTE C) ── */}
        {stage.questions.map((q, qi) => (
          <div
            key={q.key}
            style={{
              background: '#fff', borderRadius: 16,
              border: `0.5px solid ${C.border}`,
              padding: '16px', marginBottom: 10,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            {/* Cabeçalho da pergunta */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 4, alignItems: 'flex-start' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: C.purpleBg,
                fontSize: 11, fontWeight: 700, color: C.purple,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 1,
              }}>
                {qi + 1}
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.45, flex: 1 }}>
                {q.text}
              </p>
            </div>

            {/* Microcopy (PARTE C) */}
            {q.hint && (
              <p style={{
                margin: '0 0 12px 32px',
                fontSize: 11, color: C.textSec, lineHeight: 1.45,
                fontStyle: 'italic',
              }}>
                💡 {q.hint}
              </p>
            )}

            {!q.hint && <div style={{ marginBottom: 12 }} />}

            {/* Opções — select */}
            {q.type === 'select' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {q.options.map(opt => {
                  const sel = answers[q.key] === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectAnswer(q.key, opt.value)}
                      style={{
                        border: sel ? `2px solid ${C.purple}` : `1.5px solid ${C.border}`,
                        borderRadius: 12, padding: '10px 10px',
                        background: sel ? C.purpleBg : '#FAFAFA',
                        textAlign: 'left', cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all .15s',
                      }}
                    >
                      <div style={{
                        fontSize: 12, fontWeight: sel ? 700 : 400,
                        color: sel ? C.purpleDeep : C.text, lineHeight: 1.3,
                      }}>
                        {opt.label}
                      </div>
                      {opt.desc && (
                        <div style={{ fontSize: 10, color: C.textSec, marginTop: 3, lineHeight: 1.3 }}>
                          {opt.desc}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Opções — multiselect */}
            {q.type === 'multiselect' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {q.options.map(opt => {
                  const sel = (answers[q.key] ?? '').split(',').includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleMulti(q.key, opt.value)}
                      style={{
                        border: sel ? `2px solid ${C.purple}` : `1.5px solid ${C.border}`,
                        borderRadius: 99, padding: '8px 16px',
                        fontSize: 12, cursor: 'pointer',
                        background: sel ? C.purpleBg : '#FAFAFA',
                        color: sel ? C.purpleDeep : C.textSec,
                        fontFamily: 'inherit', fontWeight: sel ? 600 : 400,
                        transition: 'all .15s',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      {sel && <span style={{ fontSize: 10 }}>✓</span>}
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        {/* ── Erro geral ── */}
        {state?.success === false && (
          <div style={{
            background: '#FEF2F0', borderRadius: 12, padding: '12px 14px', marginBottom: 12,
            color: '#B91C1C', fontSize: 13,
          }}>
            ⚠️ {state.error}
          </div>
        )}

        {/* ── Progresso em mini chips ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 14, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 10, color: C.textSec }}>Etapas concluídas:</span>
          {DNA_STAGES.map((s, i) => {
            const done = stageHasAnswer(s)
            const cur  = i === activeIdx
            return (
              <span key={s.key} style={{
                width: 22, height: 22, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                background: cur ? C.purple : done ? C.green : C.bgSecondary,
                color: cur || done ? '#fff' : C.textTer,
                border: cur ? `2px solid ${C.purple}` : 'none',
                transition: 'all .2s',
              }}>
                {done && !cur ? '✓' : i + 1}
              </span>
            )
          })}
        </div>

        {/* ── Botão de salvar ── */}
        <button
          type="submit"
          disabled={isPending}
          style={{
            width: '100%', border: 'none', borderRadius: 14, padding: '16px',
            fontSize: 15, fontWeight: 700, cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'background .2s, opacity .2s',
            background: isPending ? C.bgSecondary : C.purple,
            color: isPending ? C.textSec : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 10, opacity: isPending ? 0.7 : 1, letterSpacing: 0.2,
          }}
        >
          {isPending ? (
            <><Spinner /> Salvando...</>
          ) : stepNum === 6 ? (
            '🎯 Concluir meu DNA Financeiro'
          ) : (
            `Salvar e avançar para etapa ${stepNum + 1} →`
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeIdx < DNA_STAGES.length - 1) {
              setActiveIdx(activeIdx + 1)
            } else {
              window.location.href = `/${unitSlug}/painel`
            }
          }}
          style={{
            width: '100%', border: 'none', background: 'transparent',
            fontSize: 13, color: C.textSec, cursor: 'pointer',
            padding: '10px', fontFamily: 'inherit',
          }}
        >
          {stepNum === 6 ? 'Voltar ao painel sem concluir' : 'Pular esta etapa →'}
        </button>
      </form>

      {/* ── Rodapé de privacidade ── */}
      <p style={{ textAlign: 'center', fontSize: 11, color: C.textTer, marginTop: 16, lineHeight: 1.5 }}>
        🔒 Suas respostas são privadas e protegidas.<br />
        Elas ajudam a personalizar seu diagnóstico financeiro.
      </p>
    </>
  )
}

// =============================================================================
// Sub-componentes
// =============================================================================

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity=".3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        style={{ animation: 'spin .8s linear infinite', transformOrigin: 'center' }}
      />
    </svg>
  )
}
