# Navegação por teclado no menu suspenso do cabeçalho

## Situação atual

O menu "Administração" do cabeçalho (`MenuSuspenso`, em `src/components/app/AppShell.tsx`) usa o componente
DropdownMenu baseado em Radix. Ele já traz de fábrica: abrir com Enter/Espaço/seta para baixo, mover com
setas, fechar com Esc e devolver o foco ao gatilho. O que falta é garantir e comprovar esse comportamento
com os itens em formato de link (`asChild` + `Link`), onde o retorno de foco pode se perder na navegação,
e tornar a experiência mais previsível.

## O que será feito

1. **Reforçar o comportamento do menu**
   - Ativar navegação circular (`loop`) para as setas: do último item volta ao primeiro e vice-versa.
   - Definir `textValue` em cada item para que a busca por digitação use apenas o título do item, e não
     também a descrição em texto pequeno.
   - Tratar o retorno de foco ao fechar: quando o menu fecha com Esc ou clique fora, o foco volta ao botão
     do cabeçalho; quando o usuário escolhe um item e a página muda, o foco não é puxado de volta ao gatilho.

2. **Dica de teclado para leitores de tela**
   - Texto acessível curto no menu informando que as setas navegam e Esc fecha.

3. **Testes automatizados**
   - Novos testes cobrindo: abrir com Enter e com seta para baixo, mover com setas (incluindo o giro no fim
     da lista), fechar com Esc com o foco voltando ao botão, e selecionar um item com Enter.

## Detalhes técnicos

- Arquivo alterado: `src/components/app/AppShell.tsx` (apenas o bloco `MenuSuspenso`).
- Props usadas: `loop` e `onCloseAutoFocus` em `DropdownMenuContent`, `textValue` em `DropdownMenuItem`.
- Novo arquivo de teste: `src/components/app/menu-suspenso.test.tsx`, com Testing Library e `userEvent`.
- Nenhuma mudança em regras de negócio, no motor de precificação ou no backend.
