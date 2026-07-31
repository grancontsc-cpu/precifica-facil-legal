## O que já está pronto e funcionando

- **Motor de precificação** (`pricing-engine`), comparação de fornecedores, relatórios (imprimir/PDF/CSV/WhatsApp).
- **Telas**: simulador, comparar, simulações, produtos, perfis tributários, empresas, painel de gestão, painel admin (usuários, convites, licenças, solicitações, auditoria, e-mails, simulações, perfis).
- **Segurança**: RLS, papéis (super_admin/manager/user), snapshots imutáveis, auditoria, registro de acessos negados, eventos de e-mail e teste de e-mail ponta a ponta.
- 147 testes automatizados.

## Lacunas reais encontradas na revisão

1. **Beco sem saída no primeiro acesso.** Existe a função `concluirOnboarding` no servidor, mas nenhuma tela a chama. Em `/entrando`, um usuário com e-mail confirmado e sem empresa cai em `/acesso-negado` — ou seja, quem se cadastra sozinho não consegue criar empresa nem iniciar o teste gratuito pela interface.
2. **Pedidos de vínculo sem tela de aprovação.** A tabela `organization_join_requests` é preenchida quando o CNPJ já existe, mas não há painel para o gestor/admin aprovar ou recusar — o usuário fica parado em "aguardando aprovação".
3. **Planos e recursos sem interface.** Existem `plans`, `features`, `plan_features` e `license_feature_overrides` no banco e a função `can_use_feature`, mas nada disso é gerenciável ou aplicado nas telas.
4. **Nenhum e-mail do aplicativo.** Só há e-mails de autenticação; não sai aviso de fim de teste, aprovação de acesso, nem solicitação pendente para o Administrador Geral.
5. **Painéis pobres em informação.** Gestão e Admin têm ~100 linhas cada, sem indicadores (simulações no mês, usuários ativos, margem média, licenças a vencer).

## Roteiro sugerido (ordem de impacto)

### Etapa 1 — Fechar o fluxo de entrada (essencial)
- Tela `/onboarding`: nome, empresa, CNPJ, UF/cidade, aceite de termos, chamando `concluirOnboarding`.
- `/entrando` passa a mandar para `/onboarding` quem está ativo e sem empresa (em vez de `/acesso-negado`).
- Painel "Pedidos de vínculo" para gestor e Administrador Geral: aprovar (vira membro) ou recusar, com registro em auditoria.

### Etapa 2 — Planos, recursos e limites
- Tela admin de planos: criar/editar planos, marcar recursos por plano e exceções por licença.
- Aplicar `can_use_feature` na interface (por exemplo, comparar fornecedores e exportar PDF como recursos do plano pago), com aviso amigável de upgrade em vez de erro.
- Limites de uso por plano (nº de simulações/mês) com contador visível.

### Etapa 3 — Comunicação automática
- Templates de e-mail do aplicativo: boas-vindas, aviso de 7/3/1 dia do fim do teste, teste encerrado, acesso aprovado/recusado, novo pedido para o Administrador Geral.
- Disparo a partir dos eventos já gravados em `license_events` e nos pedidos, com registro em `/admin/emails`.

### Etapa 4 — Produtividade no dia a dia
- Importar produtos por planilha (CSV) e exportar a carteira.
- Duplicar perfil tributário como nova versão (edição guiada) e comparar duas versões lado a lado.
- Simulação em lote: aplicar um perfil a vários produtos e ver a lista de preços resultante.
- Favoritos/etiquetas e busca avançada nas simulações (produto, período, margem, autor).

### Etapa 5 — Inteligência gerencial
- Painéis com indicadores: margem média por produto, impacto de crédito recuperado, economia acumulada nas comparações, simulações por usuário/mês.
- Histórico de preço do produto (linha do tempo de simulações) para mostrar evolução de custo e margem.
- Alerta de margem abaixo do mínimo definido pela empresa.

### Etapa 6 — Acabamento
- Página de conta do usuário (nome, senha, tema, preferências de exibição).
- Central de ajuda curta dentro do app (como usar cada campo) reaproveitando o glossário.
- Testes E2E do onboarding e da aprovação de vínculo.

## Detalhes técnicos

- Nada de nova regra fiscal fora de `src/lib/pricing-engine.ts`; limites e recursos ficam em camada de licença, não no motor.
- Aprovação de vínculo e planos exigem migração apenas de políticas/grants; as tabelas já existem.
- E-mails do aplicativo usam a infraestrutura gerenciada (templates React em `src/lib/email-templates/`) e exigem domínio de e-mail configurado.
- Cada etapa entra com testes unitários próprios, mantendo a suíte atual verde.

## Sugestão

Começar pela **Etapa 1**: hoje é o único ponto que impede um cliente novo de usar o sistema sozinho.