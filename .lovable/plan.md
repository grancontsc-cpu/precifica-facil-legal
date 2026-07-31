## Conectar o Precifica Grancont ao GitHub

Importante: a conexão com o GitHub é feita por você na interface do Lovable — eu não consigo criar o repositório nem enviar o código por conta própria. Depois de conectado, a sincronização é bidirecional e automática (o que eu alterar aqui vai para o repositório, e o que você enviar ao repositório volta para cá).

### Passo a passo

1. No editor do Lovable, abra o menu **+** (canto inferior esquerdo do chat) → **GitHub** → **Connect project**.
2. Autorize o aplicativo **Lovable** no GitHub (login + permissão).
3. Escolha a conta ou organização onde o repositório será criado (ex.: sua conta pessoal ou a conta da Grancont).
4. Clique em **Create Repository**. O Lovable cria o repositório e envia todo o código atual do projeto.
5. Confira no GitHub se os arquivos apareceram (pasta `src/`, `supabase/`, `package.json`, testes etc.).

### Observações importantes

- **Segredos não vão para o repositório.** Chaves do backend (Cloud/banco, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, etc.) continuam guardadas no Lovable e não são versionadas. Se você for rodar o projeto localmente ou em outro host, precisará configurar as variáveis de ambiente lá.
- **Dados do banco não são exportados pelo GitHub.** O repositório leva apenas o código e as migrações SQL. Para exportar os dados, use Cloud → Advanced settings → Export data.
- **Uma conta GitHub por conta Lovable.** Se já houver outra conta conectada, será preciso trocar antes.
- **Repositório privado** é o recomendado, já que o projeto contém regras de negócio fiscais e a estrutura completa do sistema multiempresa.

### O que eu faço depois que você conectar

Assim que o repositório existir, posso (se você quiser) preparar o projeto para colaboração externa:

- Um `README.md` com visão geral, stack, como rodar localmente, variáveis de ambiente necessárias e como executar a suíte de testes (241+ testes).
- Um `.env.example` documentando as variáveis públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, GA ID) sem expor nada sensível.
- Um workflow de GitHub Actions rodando lint, typecheck e testes a cada push/pull request, para proteger o motor de precificação contra regressões.

Se quiser esses três itens, me avise depois de conectar (ou já aprove este plano e eu deixo tudo pronto para o momento em que a conexão for feita).