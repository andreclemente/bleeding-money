<script setup lang="ts">
import type { SavingsFinding } from '../domain/types'

const store = useSavingsStore()
await callOnce(() => store.refresh())
const selected = ref<string | null>((useRoute().query.open as string) || null)
const newCost = ref(34.9)
const busy = ref(false)
const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const current = computed(() => store.findings.find((item: SavingsFinding) => item.id === selected.value))
const openFindings = computed(() => store.findings.filter((item: SavingsFinding) => item.status === 'open'))
const resolve = async () => {
  if (!current.value) return
  busy.value = true
  try {
    await store.resolve(current.value.id, Math.round(newCost.value * 100))
    selected.value = null
  } finally {
    busy.value = false
  }
}
const dismiss = async () => {
  if (!current.value) return
  busy.value = true
  try {
    await store.dismiss(current.value.id)
    selected.value = null
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div>
    <h1>Recomendações</h1><p class="mb-6 text-medium-emphasis">
      Estimativas explicáveis, quantificáveis e acionáveis.
    </p><v-tabs>
      <v-tab value="open">
        Abertas ({{ openFindings.length }})
      </v-tab>
    </v-tabs><v-card
      v-for="finding in openFindings"
      :key="finding.id"
      class="finding-card mb-3"
      @click="selected = finding.id"
    >
      <v-card-item><v-card-title>{{ finding.title }}</v-card-title><v-card-subtitle>{{ money(finding.estimatedMonthlySavingMinCents) }}–{{ money(finding.estimatedMonthlySavingMaxCents) }}/mês · prioridade {{ finding.priority }}</v-card-subtitle></v-card-item><v-card-text>{{ finding.description }}</v-card-text>
    </v-card>
    <v-dialog
      :model-value="!!current"
      max-width="650"
      @update:model-value="value => { if (!value) selected = null }"
    >
      <v-card v-if="current">
        <v-card-title>{{ current.title }}</v-card-title><v-card-text>
          <p class="mb-4">
            {{ current.description }}
          </p><h3>Porque estamos a recomendar isto?</h3><ul class="my-3">
            <li
              v-for="line in current.evidence"
              :key="line"
            >
              ✓ {{ line }}
            </li>
          </ul><v-alert
            color="primary"
            variant="tonal"
            class="mb-4"
          >
            Poupança estimada: {{ money(current.estimatedAnnualSavingMinCents) }}–{{ money(current.estimatedAnnualSavingMaxCents) }}/ano · confiança {{ Math.round(current.confidence * 100) }}%
          </v-alert><p><strong>Próximo passo:</strong> {{ current.action }}</p><v-text-field
            v-model.number="newCost"
            class="mt-5"
            label="Novo custo mensal (€), se resolvida"
            type="number"
            step="0.01"
          />
        </v-card-text><v-card-actions>
          <v-btn
            :loading="busy"
            @click="dismiss"
          >
            Dispensar
          </v-btn><v-spacer /><v-btn
            color="primary"
            :loading="busy"
            @click="resolve"
          >
            Marcar como resolvida
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
