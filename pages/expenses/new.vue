<script setup lang="ts">
type Category = 'electricity' | 'telecom' | 'bank' | 'subscription'
const form = reactive({
  category: 'subscription' as Category,
  provider: '',
  productName: '',
  monthlyCost: 0,
  commitmentEndDate: '',
  contractedPowerKva: 3.45,
  tariffType: 'simples',
  pricePerKwh: 0,
  powerPricePerDay: 0,
  annualConsumptionKwh: 0,
  maxHistoricalPowerKva: 0,
  connectionType: 'fiber',
  downloadSpeedMbps: 100,
  uploadSpeedMbps: 0,
  mobileDataGb: 0,
  mobileLines: 0,
  tvIncluded: false,
  accountMaintenanceFee: 0,
  cardAnnualFee: 0,
  transferFees: 0,
  plan: 'Base',
  lastUsedAt: '',
  usageFrequency: ''
})
const saving = ref(false)
const cents = (value: number) => Math.round(value * 100)
const details = () => {
  if (form.category === 'electricity') return { kind: 'electricity', contractedPowerKva: form.contractedPowerKva, tariffType: form.tariffType, pricePerKwhCents: cents(form.pricePerKwh), powerPricePerDayCents: cents(form.powerPricePerDay), annualConsumptionKwh: form.annualConsumptionKwh, maxHistoricalPowerKva: form.maxHistoricalPowerKva }
  if (form.category === 'telecom') return { kind: 'telecom', connectionType: form.connectionType, downloadSpeedMbps: form.downloadSpeedMbps, uploadSpeedMbps: form.uploadSpeedMbps, mobileDataGb: form.mobileDataGb, mobileLines: form.mobileLines, tvIncluded: form.tvIncluded }
  if (form.category === 'bank') return { kind: 'bank', accountMaintenanceFeeCents: cents(form.accountMaintenanceFee), cardAnnualFeeCents: cents(form.cardAnnualFee), transferFeesCents: cents(form.transferFees) }
  return { kind: 'subscription', plan: form.plan, lastUsedAt: form.lastUsedAt || undefined, usageFrequency: form.usageFrequency || undefined }
}
const submit = async () => {
  saving.value = true
  try {
    const item = await $fetch('/api/expenses', { method: 'POST', body: { category: form.category, provider: form.provider, productName: form.productName, monthlyCostCents: cents(form.monthlyCost), commitmentEndDate: form.commitmentEndDate || undefined, details: details() } })
    await navigateTo(`/expenses/${item.id}`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="form-shell">
    <NuxtLink
      class="back-link"
      to="/expenses"
    >
      ← Voltar às despesas
    </NuxtLink>

    <header class="page-header">
      <div class="page-header-copy">
        <div class="section-kicker">
          Nova monitorização
        </div>
        <h1>Adicionar despesa</h1>
        <p class="page-subtitle">
          Regista os dados que conheces. A análise começa imediatamente e pode ser afinada mais tarde.
        </p>
      </div>
    </header>

    <div class="panel form-card">
      <v-form @submit.prevent="submit">
        <section
          class="form-section"
          aria-labelledby="basic-info-heading"
        >
          <div class="form-section-heading">
            <h2 id="basic-info-heading">
              Informação essencial
            </h2>
            <p>Usamos estes dados para identificar e comparar o serviço.</p>
          </div>
          <div class="form-grid">
            <v-select
              v-model="form.category"
              class="form-span-2"
              label="Categoria"
              :items="[{ title: 'Eletricidade', value: 'electricity' }, { title: 'Telecomunicações', value: 'telecom' }, { title: 'Banca', value: 'bank' }, { title: 'Subscrição', value: 'subscription' }]"
              variant="outlined"
            />
            <v-text-field
              v-model="form.provider"
              label="Fornecedor"
              placeholder="Ex.: EDP, Vodafone, Netflix"
              variant="outlined"
              required
            />
            <v-text-field
              v-model="form.productName"
              label="Produto ou plano"
              placeholder="Ex.: Fibra 500, Plano Premium"
              variant="outlined"
              required
            />
            <v-text-field
              v-model.number="form.monthlyCost"
              class="form-span-2"
              label="Custo mensal (€)"
              hint="Indica o valor médio que efetivamente pagas por mês."
              persistent-hint
              prefix="€"
              type="number"
              min="0"
              step="0.01"
              variant="outlined"
              required
            />
          </div>
        </section>

        <section
          class="form-section"
          aria-labelledby="details-heading"
        >
          <div class="form-section-heading">
            <h2 id="details-heading">
              Detalhes para a análise
            </h2>
            <p>Campos adaptados à categoria escolhida.</p>
          </div>
          <div class="form-grid">
            <template v-if="form.category === 'electricity'">
              <v-text-field
                v-model.number="form.contractedPowerKva"
                label="Potência contratada (kVA)"
                type="number"
                min="0"
                step="0.01"
                variant="outlined"
                required
              />
              <v-text-field
                v-model="form.tariffType"
                label="Tipo de tarifa"
                variant="outlined"
                required
              />
              <v-text-field
                v-model.number="form.pricePerKwh"
                label="Preço por kWh (€)"
                type="number"
                min="0"
                step="0.0001"
                variant="outlined"
                required
              />
              <v-text-field
                v-model.number="form.powerPricePerDay"
                label="Preço diário da potência (€)"
                type="number"
                min="0"
                step="0.0001"
                variant="outlined"
                required
              />
              <v-text-field
                v-model.number="form.annualConsumptionKwh"
                label="Consumo anual (kWh)"
                type="number"
                min="0"
                step="1"
                variant="outlined"
                required
              />
              <v-text-field
                v-model.number="form.maxHistoricalPowerKva"
                label="Potência máxima histórica (kVA)"
                type="number"
                min="0"
                step="0.01"
                variant="outlined"
                required
              />
            </template>

            <template v-if="form.category === 'telecom'">
              <v-text-field
                v-model="form.commitmentEndDate"
                class="form-span-2"
                label="Fim da fidelização"
                type="date"
                variant="outlined"
              />
              <v-text-field
                v-model="form.connectionType"
                label="Tipo de ligação"
                variant="outlined"
                required
              />
              <v-text-field
                v-model.number="form.downloadSpeedMbps"
                label="Download (Mbps)"
                type="number"
                min="0"
                step="1"
                variant="outlined"
                required
              />
              <v-text-field
                v-model.number="form.uploadSpeedMbps"
                label="Upload (Mbps)"
                type="number"
                min="0"
                step="1"
                variant="outlined"
              />
              <v-text-field
                v-model.number="form.mobileDataGb"
                label="Dados móveis (GB)"
                type="number"
                min="0"
                step="1"
                variant="outlined"
              />
              <v-text-field
                v-model.number="form.mobileLines"
                label="Linhas móveis"
                type="number"
                min="0"
                step="1"
                variant="outlined"
              />
              <v-checkbox
                v-model="form.tvIncluded"
                label="O pacote inclui televisão"
                color="primary"
              />
            </template>

            <template v-if="form.category === 'bank'">
              <v-text-field
                v-model.number="form.accountMaintenanceFee"
                label="Comissão mensal de manutenção (€)"
                type="number"
                min="0"
                step="0.01"
                variant="outlined"
                required
              />
              <v-text-field
                v-model.number="form.cardAnnualFee"
                label="Anuidade do cartão (€)"
                type="number"
                min="0"
                step="0.01"
                variant="outlined"
                required
              />
              <v-text-field
                v-model.number="form.transferFees"
                class="form-span-2"
                label="Comissões de transferência (€)"
                type="number"
                min="0"
                step="0.01"
                variant="outlined"
                required
              />
            </template>

            <template v-if="form.category === 'subscription'">
              <v-text-field
                v-model="form.plan"
                class="form-span-2"
                label="Plano da subscrição"
                variant="outlined"
                required
              />
              <v-text-field
                v-model="form.lastUsedAt"
                label="Última utilização"
                type="date"
                variant="outlined"
              />
              <v-text-field
                v-model="form.usageFrequency"
                label="Frequência de utilização"
                placeholder="Ex.: semanal, raramente"
                variant="outlined"
              />
            </template>
          </div>
        </section>

        <div class="form-actions">
          <v-btn
            to="/expenses"
            variant="text"
            :disabled="saving"
          >
            Cancelar
          </v-btn>
          <v-btn
            type="submit"
            color="primary"
            size="large"
            :loading="saving"
          >
            Guardar e analisar
          </v-btn>
        </div>
      </v-form>
    </div>
  </div>
</template>
