## Situação atual (inspecionada)

O projeto **já tem backend (Lovable Cloud) e autenticação** funcionando. Não vou criar um segundo backend nem recriar nada. O que já existe:

- Login por e-mail/senha + Google em `/auth`, rotas protegidas em `/_authenticated/*`.
- Tabelas: `profiles`, `organizations`, `organization_members` (papéis `org_admin`/`viewer`), `user_roles` (papel `grancont_admin`), `products`, `tax_profiles`, `tax_profile_lines`, `simulations` (+ linhas e snapshots), `audit_logs` — todas com RLS ativa.
- Rotas: `/simulador`, `/comparar`, `/simulacoes`, `/produtos`, `/perfis`, `/empresas`, `/auditoria`.
- Motor de precificação e 86 testes — **não serão tocados**.

Ou seja: boa parte do pedido já está no ar, mas com nomes de papéis diferentes e sem convites, status de conta e painéis administrativos.

## O que muda

### 1. Banco de dados (migrations, com checkpoint antes)

- **Papéis**: renomear conceitualmente para `super_admin` (global, em `global_user_roles`), `manager` e `user` (por empresa, em `organization_members.role`). Migração de dados: `grancont_admin` → `super_admin`, `org_admin` → `manager`, `viewer` → `user`. Nada é apagado.
- **`profiles`**: acrescentar `phone`, `avatar_url`, `account_status` (invited, pending_email_verification, pending_approval, active, suspended, rejected, archived), `email_verified_at`, `last_access_at`.
- **`organizations`**: acrescentar `legal_name`, `trade_name`, `active` (já existe), CNPJ único quando preenchido. O campo `name` atual é preservado.
- **`organization_members`**: acrescentar `membership_status`, `invited_by`, `approved_by`, `joined_at`, `updated_at`.
- **`global_user_roles`**: nova tabela, só super_admin lê/escreve.
- **`invitations`**: nova tabela (e-mail normalizado, empresa, papel pretendido, status, quem convidou, expiração, aceite, cancelamento).
- **`audit_logs`**: já existe; acrescentar as ações de usuários/convites/empresas.
- **`simulations`/`products`**: acrescentar apenas o que falta (`updated_by`, `archived_at`, `calculation_version`, `active`). Snapshots imutáveis já existem e continuam.
- **Organização inicial "Grancont"** e vínculo do Administrador Geral criados por migration; registros existentes sem empresa são associados a ela antes de qualquer campo virar obrigatório.
- **Administrador Geral**: `raulalmeida6@gmail.com` é semeado por migration/função segura no banco (nunca comparado no frontend). Regras protegidas por trigger: manager não promove ninguém, só super_admin cria/remove super_admin, o último super_admin não pode ser removido.

### 2. Funções seguras + RLS

Funções `SECURITY DEFINER` com `search_path` fixo: `is_super_admin()`, `is_active_user()`, `is_org_member()`, `has_org_role()`, `can_manage_org_users()`, `can_access_simulation()`. Todas as políticas passam a exigir **conta com status `active`** — usuário suspenso perde acesso na hora, pelo banco. Default deny, sem acesso anônimo, GRANTs explícitos por tabela.

### 3. Lógica administrativa no servidor

Neste stack (TanStack Start), a camada segura equivalente às Edge Functions são **server functions** com validação de token e papel — mesmo efeito, sem expor chave de serviço. Serão criadas: `invite_user`, `resend_invitation`, `cancel_invitation`, `accept_invitation`, `approve_user`, `reject_user`, `suspend_user`, `reactivate_user`, `change_member_role`, `move_user_between_organizations`, `send_password_reset`, `archive_user`. Cada uma valida token → conta ativa → papel/empresa → schema do corpo → executa → grava auditoria.

### 4. Rotas

Públicas novas: `/login` (mantendo `/auth` como redirecionamento), `/aceitar-convite`, `/esqueci-minha-senha`, `/redefinir-senha`, `/confirmar-email`, `/aguardando-aprovacao`, `/acesso-bloqueado`, `/acesso-negado`.

Protegidas: `/simulador` **preservada como está**, `/minhas-simulacoes`, `/gestao` + `/gestao/usuarios` + `/gestao/simulacoes`, `/admin` + `/admin/empresas`, `/admin/usuarios`, `/admin/convites`, `/admin/simulacoes`, `/admin/perfis-tributarios`, `/admin/auditoria`, `/admin/configuracoes`. As telas atuais (`/produtos`, `/perfis`, `/empresas`, `/auditoria`, `/comparar`, `/simulacoes`) continuam existindo e são reaproveitadas dentro dos painéis.

Redirecionamento pós-login por papel/status, com estado de carregamento (sem flash de conteúdo protegido).

### 5. Interface

- Tela de login redesenhada dentro da identidade atual (sem botão de cadastro público), com mostrar/ocultar senha e mensagens em português.
- Cabeçalho com nome, empresa ativa, papel amigável e menu de perfil; seletor de empresa quando houver mais de um vínculo; "Visão administrativa" para super_admin.
- Painel do Administrador Geral (resumo + 8 seções, tabelas com filtros e ações) e painel do Gestor (resumo da empresa, usuários, convites, simulações).
- O simulador e seu design **não são alterados**.

### 6. Configuração de autenticação e e-mails

Cadastro público desativado, login anônimo desativado, auto-confirmação desativada, senha mínima 8, verificação de senha vazada ativada, URLs de redirecionamento da aplicação publicada configuradas. Templates de e-mail com identidade Precifica Grancont (convite, confirmação, recuperação, acesso ativado, conta suspensa, reativada) — dependem de um domínio de envio; aviso caso ainda não exista.

### 7. Testes

Mantenho os 86 testes atuais intactos e acrescento testes das regras de acesso (papéis, status, convites expirados/reutilizados/e-mail divergente, isolamento entre empresas) e verificação de que o motor produz exatamente os mesmos resultados. Ao final, rodo o Security Scan e corrijo o que for crítico.

## Ordem de execução

1. Checkpoint.
2. Migrations (schema + migração de dados + funções + RLS + semear super_admin e empresa Grancont).
3. Configuração de autenticação.
4. Server functions administrativas.
5. Rotas públicas e de recuperação/convite.
6. Painéis admin/gestão + cabeçalho e guardas de rota.
7. Testes + Security Scan + relatório final.

## Observações honestas

- É um escopo grande; vou entregar em etapas nesta mesma sequência, verificando build e testes a cada bloco.
- Personificação ("entrar como outro usuário") não será implementada, conforme pedido.
- Envio real de e-mails de convite exige um domínio de envio configurado; se não houver, os convites funcionam por link gerado e aviso na interface até o domínio ser configurado.
