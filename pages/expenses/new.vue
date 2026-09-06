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
  <div>
    <h1 class="mb-2">
      Adicionar primeira despesa
    </h1>
    <p class="mb-6">
      Vamos descobrir quanto dinheiro estás a perder todos os meses.
    </p>
    <v-card max-width="680">
      <v-card-text>
        <v-form @submit.prevent="submit">
          <v-select
            v-model="form.category"
            label="Categoria"
            :items="[{ title: 'Eletricidade', value: 'electricity' }, { title: 'Telecomunicações', value: 'telecom' }, { title: 'Banco', value: 'bank' }, { title: 'Subscrição', value: 'subscription' }]"
          />
          <v-text-field
            v-model="form.provider"
            label="Fornecedor"
            required
          />
          <v-text-field
            v-model="form.productName"
            label="Produto ou plano"
            required
          />
          <v-text-field
            v-model.number="form.monthlyCost"
            label="Custo mensal (€)"
            type="number"
            min="0"
            step="0.01"
            required
          />
          <v-text-field
            v-if="form.category === 'telecom'"
            v-model="form.commitmentEndDate"
            label="Fim da fidelização"
            type="date"
          />

          <template v-if="form.category === 'electricity'">
            <v-text-field
              v-model.number="form.contractedPowerKva"
              label="Potência contratada (kVA)"
              type="number"
              min="0"
              step="0.01"
              required
            />
            <v-text-field
              v-model="form.tariffType"
              label="Tipo de tarifa"
              required
            />
            <v-text-field
              v-model.number="form.pricePerKwh"
              label="Preço por kWh (€)"
              type="number"
              min="0"
              step="0.0001"
              required
            />
            <v-text-field
              v-model.number="form.powerPricePerDay"
              label="Preço diário da potência (€)"
              type="number"
              min="0"
              step="0.0001"
              required
            />
            <v-text-field
              v-model.number="form.annualConsumptionKwh"
              label="Consumo anual (kWh)"
              type="number"
              min="0"
              step="1"
              required
            />
            <v-text-field
              v-model.number="form.maxHistoricalPowerKva"
              label="Potência máxima histórica (kVA)"
              type="number"
              min="0"
              step="0.01"
              required
            />
          </template>

          <template v-if="form.category === 'telecom'">
            <v-text-field
              v-model="form.connectionType"
              label="Tipo de ligação"
              required
            />
            <v-text-field
              v-model.number="form.downloadSpeedMbps"
              label="Download (Mbps)"
              type="number"
              min="0"
              step="1"
              required
            />
            <v-text-field
              v-model.number="form.uploadSpeedMbps"
              label="Upload (Mbps)"
              type="number"
              min="0"
              step="1"
            />
            <v-text-field
              v-model.number="form.mobileDataGb"
              label="Dados móveis (GB)"
              type="number"
              min="0"
              step="1"
            />
            <v-text-field
              v-model.number="form.mobileLines"
              label="Linhas móveis"
              type="number"
              min="0"
              step="1"
            />
            <v-checkbox
              v-model="form.tvIncluded"
              label="Inclui televisão"
            />
          </template>

          <template v-if="form.category === 'bank'">
            <v-text-field
              v-model.number="form.accountMaintenanceFee"
              label="Comissão mensal de manutenção (€)"
              type="number"
              min="0"
              step="0.01"
              required
            />
            <v-text-field
              v-model.number="form.cardAnnualFee"
              label="Anuidade do cartão (€)"
              type="number"
              min="0"
              step="0.01"
              required
            />
            <v-text-field
              v-model.number="form.transferFees"
              label="Comissões de transferência (€)"
              type="number"
              min="0"
              step="0.01"
              required
            />
          </template>

          <template v-if="form.category === 'subscription'">
            <v-text-field
              v-model="form.plan"
              label="Plano da subscrição"
              required
            />
            <v-text-field
              v-model="form.lastUsedAt"
              label="Última utilização"
              type="date"
            />
            <v-text-field
              v-model="form.usageFrequency"
              label="Frequência de utilização"
            />
          </template>

          <v-btn
            type="submit"
            color="primary"
            :loading="saving"
          >
            Guardar e analisar
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>
