<template>
  <div>
    <v-app-bar
      flat
      color="surface"
    >
      <v-app-bar-title class="font-weight-bold">
        Poupanças
      </v-app-bar-title><v-spacer /><v-btn to="/dashboard">
        Resumo
      </v-btn><v-btn to="/expenses">
        Despesas
      </v-btn><v-btn to="/findings">
        Recomendações
      </v-btn>
    </v-app-bar>
    <v-main>
      <v-container class="py-8">
        <slot />
      </v-container>
    </v-main>
  </div>
</template>
