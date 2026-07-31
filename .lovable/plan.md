## Objetivo

Permitir que um usuário sem permissão administrativa envie um pedido de acesso ao painel, com seu e-mail e o motivo, e que o Administrador Geral veja e trate esses pedidos dentro do sistema (sem envio de e-mail).

## O que será feito

### 1. Formulário na tela "Acesso negado"
Na página `/acesso-negado` (para onde a proteção de rota já redireciona quem tenta abrir `/admin` sem permissão) entra um botão **Solicitar acesso ao painel**, abrindo um diálogo com:
- E-mail do solicitante (preenchido automaticamente com a conta logada, somente leitura)
- Área desejada (Painel do Administrador Geral / Gestão da empresa)
- Motivo da solicitação (obrigatório, mínimo de 10 caracteres)
- Contato alternativo (opcional)

Mesmo padrão visual e de mensagens do pedido de acesso a simulações já existente, responsivo em celular.

### 2. Registro do pedido
O envio passa por uma função de servidor que valida a identidade e grava o pedido na tabela de solicitações já existente (`access_requests`), sem simulação vinculada, marcado como pedido de acesso administrativo. Regras:
- Bloqueia pedidos duplicados em análise do mesmo usuário
- Grava o pedido também na auditoria (quem, quando, motivo)
- Nenhum dado sensível volta para a tela — apenas a confirmação de envio

### 3. Fila de solicitações no painel do Administrador Geral
Nova página **Solicitações de acesso** dentro de `/admin`, listando os pedidos pendentes e tratados com: nome e e-mail do solicitante, área pedida, motivo, data, situação. Ações: **Aprovar/Marcar como tratado** e **Recusar**, ambas registrando quem tratou e quando, com auditoria. Aparece um contador de pendentes no menu do admin.

Observação: marcar como tratado registra a decisão; a concessão efetiva de papel continua sendo feita nas telas de usuários/convites já existentes (evita conceder privilégio por um clique de fila).

## Detalhes técnicos

- Nova migração apenas para complementar a tabela `access_requests` com a coluna de área solicitada (`requested_area`) e políticas de leitura/atualização para super_admin; nenhuma tabela nova.
- Nova função de servidor `src/lib/solicitacao-admin.functions.ts` com `requireSupabaseAuth`, validação Zod e escrita via cliente administrativo após verificar o usuário.
- Novo componente `src/components/app/SolicitarAcessoAdmin.tsx`; nova rota `src/routes/_authenticated/admin/solicitacoes.tsx` protegida por `ExigePapel`.
- Motor de cálculo, rota `/simulador`, design e os 140 testes existentes permanecem intactos; nenhum arquivo do motor é tocado.
