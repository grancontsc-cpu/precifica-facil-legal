# Suporte a aumento de fonte até 200% no cabeçalho

## Objetivo

Quando o usuário aumenta a fonte no navegador ou no sistema (até 200%), a logo, o atalho
"Pular para o simulador" e a dica (tooltip) devem continuar legíveis e dentro da tela, sem
texto cortado, sobreposto ou empurrado para fora do cabeçalho.

## O que muda

1. **Logo do cabeçalho**
   - A altura da logo passa a acompanhar o tamanho da fonte (medida relativa em vez de altura
     fixa em pixels), com um teto para não crescer demais em telas pequenas.
   - O link deixa de forçar texto em linha única e o limite de largura passa a ser relativo,
     evitando que a logo empurre os demais itens do cabeçalho.

2. **Atalho "Pular para o simulador"**
   - Passa a permitir quebra em duas linhas e altura mínima flexível, mantendo o alvo de toque
     de 44px e o contraste atual.
   - Largura limitada à tela, com espaçamento seguro nas bordas mesmo com fonte ampliada.

3. **Dica (tooltip)**
   - Largura máxima e recuo internos passam a ser relativos à fonte, e a altura ganha rolagem
     interna caso o texto ultrapasse a área visível.

4. **Barra do cabeçalho**
   - A altura da barra passa a se adaptar ao conteúdo (altura mínima em vez de fixa), com quebra
     de linha dos grupos quando o espaço acaba, para que nada seja cortado a 200%.

5. **Verificação**
   - Teste automatizado de layout com fonte a 200% verificando que o cabeçalho, o atalho e a dica
     não ultrapassam a largura da janela.

## Detalhes técnicos

- Arquivos: `src/components/app/LogoInicio.tsx`, `src/components/app/AppShell.tsx`,
  `src/components/ui/tooltip.tsx` e, se necessário, um utilitário em `src/styles.css`.
- Substituição de utilitários fixos (`h-7/h-8`, `h-16`, `max-w-[60vw]`, `whitespace-nowrap`) por
  equivalentes relativos (`h-[2em]`, `min-h-16`, `max-w-[min(60vw,20rem)]`, `flex-wrap`).
- Novo teste em `src/tests/escala-fonte.test.tsx` (jsdom) medindo estouro horizontal com
  `font-size: 200%` aplicado ao documento.
- Sem alterações no motor de precificação, em regras fiscais ou no backend.
