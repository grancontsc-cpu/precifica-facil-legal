
# Apanhado geral e plano de melhoria de usabilidade

## O que o app já faz bem
- Motor de cálculo sólido, testado e separado da interface.
- Multiempresa com papéis, licenças e auditoria.
- Relatórios (imprimir/PDF/CSV/WhatsApp) e comparação de fornecedores.
- Textos em português e identidade roxa/grafite consistente.

## Onde a experiência trava hoje
1. **Navegação**: o menu do topo tem até 15 links numa barra rolável horizontal. No celular vira uma faixa confusa; no desktop não há hierarquia entre "usar o sistema" e "administrar".
2. **Simulador denso**: dezenas de campos técnicos (base, alíquota, crédito, por fora, informativo) aparecem todos de uma vez. Um usuário leigo não sabe por onde começar.
3. **Resultado escondido no celular**: o painel de resultados fica na coluna lateral (`sticky` no desktop) e no celular cai lá embaixo — a pessoa digita sem ver o preço mudar.
4. **Sem entrada guiada**: não há um "primeiro passo" — nada explica o que é uma simulação, nem oferece um exemplo pronto de forma visível.
5. **Vocabulário fiscal cru**: rótulos como "MVA-ST", "base reduzida", "crédito presumido" sem tradução em linguagem simples.
6. **Personalização zero**: nenhuma marca da empresa cliente (logo, nome), sem tema claro/escuro escolhido pelo usuário, sem preferências salvas.

## Plano proposto (em 5 etapas, cada uma entregável sozinha)

### Etapa 1 — Navegação clara em qualquer tela
- **Celular**: barra inferior fixa com 4 ações principais (Simulador, Comparar, Simulações, Mais) + folha lateral com o restante agrupado.
- **Desktop**: menu enxuto com os 5 itens de uso diário e um menu suspenso "Administração" para o resto.
- Nome da empresa ativa e seletor sempre visível; e-mail/sair dentro de um menu de conta com avatar.

### Etapa 2 — Modo Simples x Modo Completo no simulador
- Chave no topo: **Simples** (padrão para quem entra pela primeira vez) mostra só Produto, Valor de compra, Frete, Regime, Margem desejada — o resto usa o perfil tributário da empresa.
- **Completo** revela todos os cards de tributos como hoje.
- Preferência salva por usuário.

### Etapa 3 — Resultado sempre à vista
- No celular: barra inferior de resultado (preço sugerido + custo líquido) fixa acima da navegação, com toque para abrir o detalhe completo.
- No desktop: manter a coluna lateral, com destaque maior no preço final e nos 3 números-chave.
- Animação suave quando o valor muda, para o usuário perceber o efeito do que digitou.

### Etapa 4 — Linguagem para leigos
- Cada campo técnico ganha um texto de ajuda em uma frase, sem jargão ("Frete pago na compra: quanto você paga para a mercadoria chegar até você").
- Tela de boas-vindas na primeira simulação com 3 passos e botão "Ver exemplo pronto".
- Mensagens de erro/validação reescritas em tom de orientação, não de recusa.
- Glossário curto acessível em qualquer tela.

### Etapa 5 — Personalização
- Cada empresa pode definir logo e nome que aparecem no cabeçalho e nos relatórios.
- Tema claro/escuro com opção "seguir o sistema" (o tema escuro já existe no CSS mas não é acessível).
- Preferências do usuário: modo simples/completo, empresa padrão, cenário inicial favorito.
- Tamanhos de toque mínimos de 44px e campos numéricos com teclado numérico no celular.

## Detalhes técnicos
- Nenhuma alteração em `src/lib/pricing-engine.ts` nem nas regras fiscais — todo o trabalho é de apresentação.
- Novos componentes: `NavegacaoMobile`, `MenuConta`, `ResumoFlutuante`, `AlternadorModo`, `Glossario`, `SeletorTema`.
- Preferências e branding: colunas novas em `profiles` (preferências) e `organizations` (logo/nome de exibição), com RLS igual à existente.
- Tokens de tema já existem em `src/styles.css`; a etapa 5 apenas expõe o `.dark` já definido.
- Os 146 testes atuais continuam válidos; acrescento testes para as preferências e para o modo simples.

## Sugestão de ordem
Etapas 1 → 3 → 2 dão o maior ganho percebido no celular. A 4 e a 5 podem vir depois. Posso começar pela Etapa 1, ou por outra que você preferir.
