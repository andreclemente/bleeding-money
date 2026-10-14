# Reestruturação do produto

## Proposta

O BleedingMoney é uma **auditoria de despesas familiares**: transforma dados introduzidos pelo titular num próximo passo verificável. Não promete encontrar dinheiro nem substituir uma decisão humana.

O ciclo principal é:

**Registar → Comparar → Decidir → Confirmar → Repetir**

A superfície “Hoje” apresenta uma Rota Familiar com exatamente uma ação seguinte. O extrato mantém separados os custos recorrentes confirmados, as reduções anuais confirmadas, os intervalos identificados e os planos condicionais definidos pelo utilizador.

## Papel da IA

A IA pode ajudar a classificar, ordenar e explicar casos com base em regras e evidência visível. Não recolhe dados em segundo plano, não executa alterações e não converte uma estimativa numa redução confirmada. Uma redução só conta depois de o titular introduzir o novo custo real.

## Regras de evidência

- O histórico próprio vem primeiro. Tendências exigem pelo menos três meses comparáveis.
- Coortes anónimas exigem correspondência exata dos critérios e pelo menos 10 agregados familiares. Uma comparação não prova desperdício.
- Habitação é contexto factual. Renda, prestação e condomínio ficam excluídos de limites, planos de redução e alegações de perda.
- Seguros são factuais por defeito. Só pode existir estimativa quando houver proposta comparável com coberturas e condições suficientemente equivalentes; sem essa evidência, mostramos apenas data, prémio e coberturas declaradas.
- Findings da mesma despesa podem descrever sinais relacionados, mas a Rota e o extrato escolhem um único caso representativo por despesa. Intervalos sobrepostos nunca são somados.
- Um plano anual derivado de limites escolhidos pelo utilizador é condicional e fica separado das reduções confirmadas.
- O objetivo familiar usa apenas ações concluídas e custos novos confirmados. Estimativas nunca contam como progresso.
- Um resultado vazio ou saudável é válido. O produto não inventa nem fabrica perdas para preencher o ecrã.
- Todos os montantes são inteiros em cêntimos, apresentados em EUR e com os cêntimos preservados.

## Dados e acesso

Os dados pertencem a um único titular autenticado. Serviços e API obtêm a identidade exclusivamente da sessão; o cliente nunca envia `userId`. Atualizações acontecem quando o titular regista ou altera informação.

## Não-objetivos

Esta fase não inclui:

- OCR de faturas ou recibos
- Open Banking
- scraping de preços ou contratos
- mudança automática de fornecedor
- tarefas contínuas em segundo plano
- previsões sem fonte, comparabilidade ou evidência
- reescrita integral das rotas existentes

As rotas atuais continuam funcionais; a navegação principal apenas realça as quatro tarefas: Hoje, Registar, Contratos e Objetivo. Método, privacidade e arquivo permanecem acessíveis como navegação secundária.

## Evolução operacional

A superfície principal passa de **Monitor** para **Operate**: não abre com um conjunto de cartões nem com métricas decorativas. Abre com uma bancada de decisão que explica uma única prioridade e o seu impacto possível no objetivo.

Três instrumentos tornam o produto reconhecível e útil sem novas fontes de dados:

1. **Impacto no objetivo** — mostra quanto um caso aberto poderia alterar a meta, sempre como intervalo condicional e sem mover o progresso confirmado.
2. **Radar 45 dias** — transforma datas reais de renovação de seguros numa fila temporal acionável antes do prazo.
3. **Ponte decisão → objetivo** — torna visível o percurso Identificar → Confirmar → Direcionar e separa visualmente hipótese de resultado.

A linguagem visual é uma bancada de auditoria: grelha produtiva, superfícies planas, alto contraste, tipografia técnica e uma única cor interativa. Evita beige editorial, cartões arredondados repetidos, ícones decorativos, sombras e hierarquia de dashboard genérico.
