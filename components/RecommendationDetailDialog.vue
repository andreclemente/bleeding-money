<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SavingsFinding } from '../domain/types'

const props = defineProps<{
  modelValue: boolean
  finding: SavingsFinding | undefined
  currentExpenseCostCents: number
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  close: []
  dismiss: []
  resolve: [newCostCents: number, actionDate: string]
}>()

const newCost = ref<string | number>('')
const observedDate = ref('')
const observedEvidence = ref(false)
const now = new Date()
const currentCivilDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const money = (cents: number) => new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR'
}).format(cents / 100)
const confidenceLabel = computed(() => {
  const confidence = props.finding?.confidence || 0
  if (confidence >= 0.8) return 'Confiança alta'
  if (confidence >= 0.6) return 'Confiança média'
  return 'Confiança baixa'
})
const hasEstimatedSaving = computed(() => !!props.finding && (props.finding.estimatedMonthlySavingMinCents > 0 || props.finding.estimatedMonthlySavingMaxCents > 0))

watch(
  [() => props.finding?.id, () => props.currentExpenseCostCents],
  () => {
    newCost.value = ''
    observedDate.value = ''
    observedEvidence.value = false
  }
)

const parsedNewCost = computed(() => {
  const normalized = String(newCost.value).trim().replace(',', '.')
  if (!normalized || !/^-?\d+(?:\.\d+)?$/.test(normalized)) return { error: 'Introduz um valor válido em euros.' }
  if ((normalized.split('.')[1]?.length || 0) > 2) return { error: 'Usa no máximo duas casas decimais (cêntimos).' }
  const euros = Number(normalized)
  if (!Number.isFinite(euros)) return { error: 'Introduz um valor válido em euros.' }
  if (euros < 0) return { error: 'O novo custo não pode ser negativo.' }
  const cents = Math.round(euros * 100)
  if (cents >= props.currentExpenseCostCents) return { error: 'O novo custo tem de ser inferior ao custo mensal atual.' }
  return { cents, error: '' }
})
const costError = computed(() => parsedNewCost.value.error)
const evidenceError = computed(() => {
  if (!observedDate.value) return 'Indica a data da cobrança observada.'
  if (observedDate.value > currentCivilDate) return 'A data da cobrança não pode estar no futuro.'
  if (!observedEvidence.value) return 'Confirma que o valor aparece numa fatura, recibo ou extrato.'
  return ''
})

const close = () => emit('close')
const resolve = () => {
  if (parsedNewCost.value.cents === undefined || costError.value || evidenceError.value) return
  emit('resolve', parsedNewCost.value.cents, observedDate.value)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    @update:model-value="value => { if (!value) close() }"
  >
    <v-card
      v-if="finding"
      class="recommendation-dialog"
      role="document"
    >
      <div class="dialog-header">
        <div>
          <div class="section-kicker">
            Recomendação
          </div>
          <h2 class="dialog-title">
            {{ finding.title }}
          </h2>
        </div>
        <v-btn
          class="dialog-close"
          icon
          variant="text"
          aria-label="Fechar recomendação"
          :disabled="busy"
          @click="close"
        >
          <span aria-hidden="true">×</span>
        </v-btn>
      </div>

      <v-card-text class="dialog-content">
        <p class="dialog-lead">
          {{ finding.description }}
        </p>

        <div class="saving-highlight">
          <div>
            <span class="data-label">{{ hasEstimatedSaving ? 'Poupança mensal estimada' : 'Poupança não estimada' }}</span>
            <strong v-if="hasEstimatedSaving">{{ money(finding.estimatedMonthlySavingMinCents) }}–{{ money(finding.estimatedMonthlySavingMaxCents) }}</strong>
            <strong v-else>Sem proposta comparável confirmada</strong>
          </div>
          <span class="confidence-badge">{{ confidenceLabel }} · {{ Math.round(finding.confidence * 100) }}%</span>
        </div>

        <section
          class="dialog-section"
          aria-labelledby="evidence-heading"
        >
          <h3 id="evidence-heading">
            Porque recomendamos isto
          </h3>
          <ul class="evidence-list">
            <li
              v-for="line in finding.evidence"
              :key="line"
            >
              <span
                class="evidence-check"
                aria-hidden="true"
              >✓</span>
              <span>{{ line }}</span>
            </li>
          </ul>
        </section>

        <section
          class="next-step"
          aria-labelledby="action-heading"
        >
          <span
            class="next-step-icon"
            aria-hidden="true"
          >→</span>
          <div>
            <h3 id="action-heading">
              Próximo passo sugerido
            </h3>
            <p>{{ finding.action }}</p>
          </div>
        </section>

        <v-text-field
          v-if="hasEstimatedSaving"
          v-model="newCost"
          class="resolution-field"
          label="Novo custo mensal (€)"
          hint="Introduz um valor entre 0 € e o custo mensal atual, com no máximo dois cêntimos decimais."
          :error-messages="costError ? [costError] : []"
          persistent-hint
          type="number"
          min="0"
          step="0.01"
        />

        <div
          v-if="hasEstimatedSaving"
          class="resolution-evidence"
        >
          <label for="observed-date">Data da cobrança observada</label>
          <input
            id="observed-date"
            v-model="observedDate"
            data-testid="observed-date"
            type="date"
            :max="currentCivilDate"
          >
          <label>
            <input
              v-model="observedEvidence"
              data-testid="observed-evidence"
              type="checkbox"
            >
            <span>Confirmei o novo valor numa fatura, recibo ou extrato</span>
          </label>
          <p
            v-if="observedDate || observedEvidence"
            class="resolution-help"
            :class="{ 'resolution-error': evidenceError }"
          >
            {{ evidenceError || 'A cobrança observada pode confirmar uma redução real.' }}
          </p>
        </div>

        <p
          v-if="error"
          class="resolution-error"
          role="alert"
        >
          {{ error }}
        </p>

        <div class="action-explanations">
          <p><strong>Dispensar</strong> remove esta recomendação da lista sem registar poupança.</p>
          <p v-if="hasEstimatedSaving">
            <strong>Registar redução confirmada</strong> guarda apenas um custo inferior já observado e calcula a poupança anual real.
          </p>
          <p v-else>
            <strong>Marcar revisão como concluída</strong> fecha este aviso sem registar qualquer poupança.
          </p>
        </div>
      </v-card-text>

      <v-card-actions class="dialog-actions">
        <v-btn
          variant="text"
          color="error"
          :loading="busy"
          @click="emit('dismiss')"
        >
          {{ hasEstimatedSaving ? 'Dispensar' : 'Marcar revisão como concluída' }}
        </v-btn>
        <div class="dialog-actions-primary">
          <v-btn
            data-testid="decide-later"
            variant="outlined"
            :disabled="busy"
            @click="close"
          >
            Decidir mais tarde
          </v-btn>
          <v-btn
            v-if="hasEstimatedSaving"
            data-testid="resolve-finding"
            color="primary"
            :loading="busy"
            :disabled="busy || !!costError || !!evidenceError"
            @click="resolve"
          >
            Registar redução confirmada
          </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
