<script setup lang="ts">
definePageMeta({ layout: 'public' })
const checks = [
  { title: 'Subscrição sem utilização', data: 'Tipo de subscrição, custo e data da última utilização.', rule: 'Sinaliza 60 ou mais dias sem utilização registada; estima o custo mensal completo.', evidence: 'Data da última utilização e custo atual.', confidence: '95%. A data é declarada por ti; confirma antes de cancelar.' },
  { title: 'Aumento de preço', data: 'Pelo menos dois preços guardados em momentos diferentes.', rule: 'Sinaliza uma subida de pelo menos 10% e 2 € face ao primeiro registo.', evidence: 'Preço inicial, preço atual e percentagem calculada.', confidence: '98% sobre os valores registados; não determina a causa do aumento.' },
  { title: 'Fim da fidelização telecom', data: 'Data de fim da fidelização.', rule: 'Sinaliza quando a data já passou e estima até 20% do custo como margem de negociação.', evidence: 'Data de fim e tempo aproximado desde o termo.', confidence: '100% sobre a comparação de datas; a poupança continua a ser estimada.' },
  { title: 'Comparação telecom com a comunidade', data: 'Fornecedor, fibra/móvel/cabo, velocidade, preço e amostras anónimas recentes.', rule: 'Exige pelo menos 10 casos PT comparáveis dos últimos 12 meses; sinaliza preço acima do percentil 75.', evidence: 'Tamanho da amostra, intervalo p25–p75 e preço atual.', confidence: '90%. A amostra pode não representar todas as campanhas ou condições.' },
  { title: 'Comissão de manutenção bancária', data: 'Valor mensal da comissão de manutenção.', rule: 'Uma comissão positiva gera uma hipótese de poupar 80–100% através de isenção ou alternativa.', evidence: 'Comissão mensal indicada.', confidence: '90%. Depende das condições de isenção e serviços necessários.' },
  { title: 'Potência elétrica contratada', data: 'Potência contratada e máximo histórico disponibilizado.', rule: 'Separa pelo menos 1 kVA e propõe o primeiro escalão padrão entre 1,15 e 41,4 kVA que cobre o máximo histórico; sem escalão viável, não sinaliza. Estima 4–6 €/mês.', evidence: 'Potência atual, máximo histórico e escalão padrão sugerido.', confidence: '94%. Confirma picos e necessidades do agregado antes de reduzir.' }
]
</script>

<template>
  <article class="methodology">
    <header class="method-intro">
      <div class="section-kicker">
        Método verificável
      </div>
      <h1>Como funciona a análise</h1>
      <p>O BleedingMoney aplica regras explícitas aos dados que introduzes. A análise corre quando adicionas ou atualizas uma despesa; este MVP não executa tarefas contínuas em segundo plano.</p>
    </header>
    <section
      class="supported"
      aria-labelledby="supported-title"
    >
      <h2 id="supported-title">
        Despesas suportadas
      </h2>
      <p>Eletricidade; internet, TV e móvel; contas bancárias, cartões e comissões; subscrições digitais, streaming, cloud, software e SaaS.</p>
    </section>
    <section aria-labelledby="checks-title">
      <h2 id="checks-title">
        Os seis checks implementados
      </h2>
      <div class="method-list">
        <article
          v-for="(check, index) in checks"
          :key="check.title"
          class="method-row"
        >
          <span class="method-number">0{{ index + 1 }}</span>
          <div><h3>{{ check.title }}</h3><dl><div><dt>Dados necessários</dt><dd>{{ check.data }}</dd></div><div><dt>Regra</dt><dd>{{ check.rule }}</dd></div><div><dt>Evidência</dt><dd>{{ check.evidence }}</dd></div><div><dt>Incerteza</dt><dd>{{ check.confidence }}</dd></div></dl></div>
        </article>
      </div>
    </section>
    <aside class="healthy-note">
      <strong>Não encontrar uma recomendação é um resultado válido.</strong> Significa que os dados disponíveis não ultrapassaram nenhuma regra. Dados opcionais em falta são mostrados como checks indisponíveis, não como conclusões.
    </aside>
  </article>
</template>
