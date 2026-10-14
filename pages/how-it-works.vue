<script setup lang="ts">
definePageMeta({ layout: 'public' })

const steps = [
  { number: '01', title: 'Mapear', body: 'Registas a despesa, custo e periodicidade. O valor conhecido nunca é tratado como desperdício.' },
  { number: '02', title: 'Detetar mudança', body: 'O histórico revela aumentos, fim de compromissos e sinais que merecem revisão.' },
  { number: '03', title: 'Escolher missão', body: 'Regras explícitas escolhem uma única ação. Prazos e factos passam à frente de estimativas.' },
  { number: '04', title: 'Confirmar resultado', body: 'Só um novo custo real cria uma redução confirmada e pode alimentar um objetivo.' }
]

const checks = [
  { title: 'Subscrição sem utilização', data: 'Tipo de subscrição, custo e data da última utilização.', rule: 'Sinaliza 60 ou mais dias sem utilização registada; estima o custo mensal completo.', evidence: 'Data da última utilização e custo atual.', confidence: '95%. A data é declarada por ti; confirma antes de cancelar.' },
  { title: 'Aumento de preço', data: 'Pelo menos dois preços guardados em momentos diferentes.', rule: 'Sinaliza uma subida de pelo menos 10% e 2 € face ao primeiro registo.', evidence: 'Preço inicial, preço atual e percentagem calculada.', confidence: '98% sobre os valores registados; não determina a causa do aumento.' },
  { title: 'Fim da fidelização telecom', data: 'Data de fim da fidelização.', rule: 'Sinaliza quando a data já passou e estima até 20% do custo como margem de negociação.', evidence: 'Data de fim e tempo aproximado desde o termo.', confidence: '100% sobre a comparação de datas; a poupança continua a ser estimada.' },
  { title: 'Comparação telecom com a comunidade', data: 'Fornecedor, tecnologia, velocidade, preço e amostras anónimas recentes.', rule: 'Exige pelo menos 10 casos portugueses comparáveis dos últimos 12 meses; sinaliza preço acima do percentil 75.', evidence: 'Tamanho da amostra, intervalo p25–p75 e preço atual.', confidence: '90%. A amostra pode não representar todas as campanhas ou condições.' },
  { title: 'Comissão de manutenção bancária', data: 'Valor mensal da comissão de manutenção.', rule: 'Uma comissão positiva gera uma hipótese de poupar 80–100% através de isenção ou alternativa.', evidence: 'Comissão mensal indicada.', confidence: '90%. Depende das condições de isenção e serviços necessários.' },
  { title: 'Potência elétrica contratada', data: 'Potência contratada e máximo histórico disponibilizado.', rule: 'Propõe o primeiro escalão padrão que cobre o máximo histórico; sem escalão viável, não sinaliza.', evidence: 'Potência atual, máximo histórico e escalão sugerido.', confidence: '94%. Confirma picos e necessidades antes de reduzir.' }
]
</script>

<template>
  <article class="methodology methodology--control">
    <header class="method-hero">
      <div class="method-hero__copy">
        <div class="section-kicker">
          Auditor de despesas recorrentes da família
        </div>
        <h1>Percebe quanto a família paga — e o que aumentou.</h1>
        <p>Junta seguros, telecomunicações, condomínio, subscrições e outros compromissos. Cada despesa mantém o próprio histórico, periodicidade e próxima data importante.</p>
        <p class="method-positioning">
          Resultado: custo mensal equivalente, aumentos comprovados, cobranças próximas e uma despesa prioritária para rever.
        </p>
      </div>
      <aside>
        <span>Entrada mínima</span>
        <strong>Nome, valor e periodicidade.</strong>
        <p>Histórico, datas e condições podem ser acrescentados quando fizerem diferença.</p>
      </aside>
    </header>

    <section
      class="method-example"
      aria-labelledby="example-title"
    >
      <div>
        <span>Exemplo do que o produto revela</span><h2 id="example-title">
          Seguro automóvel
        </h2><small>Cobrança anual · renovação dentro de 21 dias</small>
      </div>
      <div><span>Anterior</span><strong>390 €</strong></div>
      <div class="method-example__change">
        <span>Atual</span><strong>445 €</strong><small>+55 €/ano comprovados</small>
      </div>
      <div class="method-example__mission">
        <span>Próxima missão</span><strong>Rever coberturas e pedir proposta antes da renovação.</strong>
      </div>
    </section>

    <section
      class="method-flow"
      aria-labelledby="flow-title"
    >
      <div class="method-section-heading">
        <span>O ciclo</span><h2 id="flow-title">
          Quatro passos. Uma missão de cada vez.
        </h2>
      </div>
      <ol>
        <li
          v-for="step in steps"
          :key="step.number"
        >
          <span>{{ step.number }}</span><strong>{{ step.title }}</strong><p>{{ step.body }}</p>
        </li>
      </ol>
    </section>

    <section
      class="certainty-method"
      aria-labelledby="certainty-title"
    >
      <div class="method-section-heading">
        <span>Grau de certeza</span><h2 id="certainty-title">
          O mapa não mistura coisas diferentes.
        </h2>
      </div>
      <div class="certainty-method__grid">
        <article><span>Conhecido</span><strong>Comprometido</strong><p>Custos e cobranças que registaste. Não são classificados como perda.</p></article>
        <article class="estimate">
          <span>Hipótese</span><strong>Em análise</strong><p>Intervalos e sinais que ainda precisam de validação.</p>
        </article>
        <article class="confirmed">
          <span>Comprovado</span><strong>Recuperado</strong><p>Diferença entre custo anterior e novo custo real confirmado.</p>
        </article>
      </div>
    </section>

    <section
      class="rules-section"
      aria-labelledby="checks-title"
    >
      <div class="method-section-heading method-section-heading--split">
        <div>
          <span>Motor atual</span><h2 id="checks-title">
            Regras disponíveis
          </h2>
        </div>
        <p>Abre uma regra para ver dados, cálculo e limites.</p>
      </div>
      <div class="rules-list">
        <details
          v-for="(check, index) in checks"
          :key="check.title"
        >
          <summary><span>0{{ index + 1 }}</span><strong>{{ check.title }}</strong><i>+</i></summary>
          <dl><div><dt>Dados necessários</dt><dd>{{ check.data }}</dd></div><div><dt>Regra</dt><dd>{{ check.rule }}</dd></div><div><dt>Evidência apresentada</dt><dd>{{ check.evidence }}</dd></div><div><dt>Limite</dt><dd>{{ check.confidence }}</dd></div></dl>
        </details>
      </div>
    </section>

    <section class="method-guardrails">
      <div><span>Não inventa</span><strong>Preços, utilização ou resultados</strong></div>
      <div><span>Não liga</span><strong>Contas bancárias ou fornecedores</strong></div>
      <div><span>Não penaliza</span><strong>Ausência de recomendações</strong></div>
      <p>Não encontrar um caso é um resultado válido. Significa apenas que os dados disponíveis não ultrapassaram nenhuma regra.</p>
    </section>
  </article>
</template>
