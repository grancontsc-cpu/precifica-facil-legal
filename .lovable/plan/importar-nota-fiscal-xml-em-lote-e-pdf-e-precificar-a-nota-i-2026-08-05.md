# Importar nota fiscal (XML em lote e PDF) e precificar a nota inteira

## O que será entregue

Uma nova área **Importar nota** no menu, com quatro passos:

1. **Envio** — arrastar/selecionar vários XMLs de NF-e de uma vez (lote) e/ou PDFs de DANFE.
2. **Revisão** — lista das notas lidas: fornecedor, número, data, valor total e itens; o usuário confere e corrige o que for preciso antes de calcular.
3. **Precificação** — para cada item: desembolso, créditos, custo líquido unitário e preço de venda sugerido pela margem alvo; e o total consolidado da nota.
4. **Ações** — salvar itens como produtos, salvar simulações no histórico, exportar CSV e imprimir/PDF do relatório.

## Como cada formato é tratado

- **XML (leitura exata):** lê emitente, destinatário, número/série/data, cada item (código, descrição, NCM, CFOP, unidade, quantidade, valor unitário, desconto, frete, seguro, outras despesas) e os tributos destacados por item (ICMS, ICMS-ST, FCP, IPI, PIS, Cofins), além dos totais. Vários arquivos podem ser enviados juntos.
- **PDF (leitura assistida):** extrai o texto do DANFE e tenta reconhecer os itens e os totais. Como o PDF não é um documento estruturado, o resultado sempre entra marcado como "conferir" e abre na tela de revisão com os campos editáveis. Quando a extração não for confiável, o app avisa e sugere o XML.

## Regras de cálculo (todas no motor)

- Frete, seguro, desconto e outras despesas do cabeçalho são rateados por item na proporção do valor do produto; se o item já traz esses valores, os do item prevalecem.
- Direito a crédito é decidido pelo regime da empresa e pelo CST/CSOSN do item — nunca pela alíquota. Simples/MEI não credita; Lucro Real/Presumido credita ICMS/PIS/Cofins quando o CST permite.
- ICMS-ST, FCP e IPI sem direito a crédito entram como custo.
- Cada item vira um estado de simulação e passa pelo motor existente (`simular`), sem fórmula nova na interface.
- Preço sugerido usa a margem alvo definida na tela (padrão 30%), com as despesas de venda configuráveis uma vez para a nota toda.

## Validações

- Arquivo não é NF-e, XML inválido, nota cancelada/denegada, item sem quantidade ou valor, soma dos itens diferente do total da nota, nota duplicada no mesmo lote, CNPJ do destinatário diferente do da empresa selecionada, limite de arquivos/tamanho por envio.

## Detalhes técnicos

- `src/lib/nfe/xml.ts` — parser da NF-e (DOMParser, sem dependência nova) para um modelo `NotaImportada`.
- `src/lib/nfe/pdf.ts` — extração de texto via `pdfjs-dist` (carregado só no cliente) e heurística de itens do DANFE.
- `src/lib/nfe/rateio.ts` — rateio proporcional em Decimal.
- `src/lib/nfe/para-simulacao.ts` — converte item + regime + CST em `SimulationState` (tributos, tratamento e crédito).
- `src/routes/_authenticated/importar.tsx` — assistente de 4 passos, responsivo, com tabela e cards no mobile.
- Persistência opcional em `products` e `simulations` já existentes (snapshots imutáveis mantidos).
- Testes: parser (nota com desconto, frete, ST, IPI, item importado), rateio, mapeamento CST→crédito por regime e cálculo agregado da nota.

## Fora do escopo desta etapa

Leitura de PDF escaneado (imagem sem texto) e consulta à SEFAZ pela chave de acesso.
