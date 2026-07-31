## Diagnóstico (verificado no banco)

- Lista de bootstrap de super admin contém apenas `raulalmeida6@gmail.com`.
- Esse e-mail nunca criou conta — a única conta existente é `grancontsc@gmail.com` (ativa).
- A tabela de papéis globais está vazia: **ninguém é Administrador Geral hoje**, por isso `/admin` bloqueia e o login redireciona para o simulador ou acesso negado.

## O que será feito

Uma migração de banco que:

1. Concede o papel de Administrador Geral (`super_admin`) à conta existente `grancontsc@gmail.com`, garantindo que ela fique com situação ativa.
2. Mantém `raulalmeida6@gmail.com` na lista de bootstrap; se ele já tiver conta futura, também recebe o papel — caso contrário, vira Administrador Geral automaticamente no primeiro login.
3. Garante que ambos os e-mails estejam na lista de bootstrap, para que uma recriação de conta continue promovendo corretamente.

Nada de motor de cálculo, design ou rotas é alterado.

## Como validar

Após aplicar: sair e entrar novamente com `grancontsc@gmail.com`; o redirecionamento pós-login deve levar para **/admin** e o menu deve exibir Empresas, Usuários, Convites, Perfis e Auditoria.

## Detalhes técnicos

- Inserção em `public.global_user_roles` (role `super_admin`) via migração, com `ON CONFLICT DO NOTHING`; a trigger `protect_global_roles` não bloqueia porque a migração roda sem `auth.uid()`.
- `INSERT` em `public.bootstrap_super_admins` para o segundo e-mail, com deduplicação.
- `UPDATE public.profiles SET account_status = 'active'` para o usuário promovido.
