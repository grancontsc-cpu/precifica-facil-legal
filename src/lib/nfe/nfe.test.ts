// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { distribuirProporcional } from "@/lib/nfe/rateio";
import { parseNfeXml } from "@/lib/nfe/xml";
import { itensDoTexto, notaDoTextoPdf } from "@/lib/nfe/pdf";
import {
  creditaIcms,
  creditaPisCofins,
  precificarNota,
  premissasPadrao,
} from "@/lib/nfe/para-simulacao";

function xmlNota(opcoes: { st?: boolean; ipi?: boolean; csosn?: boolean } = {}) {
  const icms = opcoes.csosn
    ? `<ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>`
    : opcoes.st
      ? `<ICMS><ICMS10><orig>0</orig><CST>10</CST><vBC>1000.00</vBC><pICMS>18.00</pICMS><vICMS>180.00</vICMS><vBCST>1500.00</vBCST><vICMSST>90.00</vICMSST><vFCPST>10.00</vFCPST></ICMS10></ICMS>`
      : `<ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>1000.00</vBC><pICMS>18.00</pICMS><vICMS>180.00</vICMS></ICMS00></ICMS>`;
  const ipi = opcoes.ipi
    ? `<IPI><IPITrib><CST>50</CST><vBC>1000.00</vBC><pIPI>5.00</pIPI><vIPI>50.00</vIPI></IPITrib></IPI>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe><infNFe Id="NFe35240612345678000199550010000012341000012348" versao="4.00">
    <ide><nNF>1234</nNF><serie>1</serie><dhEmi>2026-05-10T09:00:00-03:00</dhEmi></ide>
    <emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor SP Ltda</xNome><enderEmit><UF>SP</UF></enderEmit></emit>
    <dest><CNPJ>98765432000155</CNPJ><xNome>Comercio BA ME</xNome><enderDest><UF>BA</UF></enderDest></dest>
    <det nItem="1">
      <prod><cProd>A1</cProd><xProd>Cafe 500g</xProd><NCM>09012100</NCM><CFOP>6102</CFOP>
        <uCom>CX</uCom><qCom>100.0000</qCom><vUnCom>10.0000</vUnCom><vProd>1000.00</vProd><vDesc>50.00</vDesc></prod>
      <imposto>${icms}${ipi}
        <PIS><PISAliq><CST>01</CST><vBC>1000.00</vBC><pPIS>1.65</pPIS><vPIS>16.50</vPIS></PISAliq></PIS>
        <COFINS><COFINSAliq><CST>01</CST><vBC>1000.00</vBC><pCOFINS>7.60</pCOFINS><vCOFINS>76.00</vCOFINS></COFINSAliq></COFINS>
      </imposto>
    </det>
    <det nItem="2">
      <prod><cProd>B2</cProd><xProd>Acucar 1kg</xProd><NCM>17019900</NCM><CFOP>6102</CFOP>
        <uCom>FD</uCom><qCom>50.0000</qCom><vUnCom>20.0000</vUnCom><vProd>1000.00</vProd></prod>
      <imposto>${icms}
        <PIS><PISNT><CST>07</CST></PISNT></PIS>
        <COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>
      </imposto>
    </det>
    <total><ICMSTot><vProd>2000.00</vProd><vDesc>50.00</vDesc><vFrete>200.00</vFrete><vSeg>0.00</vSeg>
      <vOutro>0.00</vOutro><vICMS>360.00</vICMS><vST>0.00</vST><vIPI>0.00</vIPI>
      <vPIS>16.50</vPIS><vCOFINS>76.00</vCOFINS><vNF>2150.00</vNF></ICMSTot></total>
  </infNFe></NFe>
  <protNFe><infProt><cStat>100</cStat></infProt></protNFe>
</nfeProc>`;
}

describe("rateio proporcional", () => {
  it("divide na proporção dos valores e fecha exatamente com o total", () => {
    const partes = distribuirProporcional([1000, 1000], 200);
    expect(partes).toEqual([100, 100]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(200);
  });

  it("joga a diferença de centavos no maior item", () => {
    const partes = distribuirProporcional([100, 100, 100], 10);
    expect(partes.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 10);
  });

  it("divide igualmente quando não há pesos válidos", () => {
    expect(distribuirProporcional([0, 0], 10)).toEqual([5, 5]);
  });

  it("devolve zeros quando o total é zero", () => {
    expect(distribuirProporcional([10, 30], 0)).toEqual([0, 0]);
  });
});

describe("leitura do XML da NF-e", () => {
  it("lê cabeçalho, partes e itens", () => {
    const { nota, erro } = parseNfeXml(xmlNota(), "nota.xml");
    expect(erro).toBeNull();
    expect(nota?.numero).toBe("1234");
    expect(nota?.emitente.uf).toBe("SP");
    expect(nota?.destinatario.cnpj).toBe("98765432000155");
    expect(nota?.itens).toHaveLength(2);
    expect(nota?.itens[0].descricao).toBe("Cafe 500g");
    expect(nota?.itens[0].icms.valor).toBe(180);
    expect(nota?.itens[0].pis.valor).toBe(16.5);
    expect(nota?.confiavel).toBe(true);
  });

  it("rateia o frete do cabeçalho pelos itens", () => {
    const { nota } = parseNfeXml(xmlNota(), "nota.xml");
    expect(nota?.itens[0].frete).toBe(100);
    expect(nota?.itens[1].frete).toBe(100);
  });

  it("mantém o desconto que já veio no item", () => {
    const { nota } = parseNfeXml(xmlNota(), "nota.xml");
    expect(nota?.itens[0].desconto).toBe(50);
    expect(nota?.itens[1].desconto).toBe(0);
  });

  it("soma ICMS-ST com FCP-ST", () => {
    const { nota } = parseNfeXml(xmlNota({ st: true }), "nota.xml");
    expect(nota?.itens[0].icmsSt.valor).toBe(100);
  });

  it("lê o IPI destacado", () => {
    const { nota } = parseNfeXml(xmlNota({ ipi: true }), "nota.xml");
    expect(nota?.itens[0].ipi.valor).toBe(50);
  });

  it("avisa sobre compra interestadual", () => {
    const { nota } = parseNfeXml(xmlNota(), "nota.xml");
    expect(nota?.avisos.join(" ")).toMatch(/fronteira/i);
  });

  it("rejeita arquivo que não é NF-e", () => {
    const { nota, erro } = parseNfeXml("<xml><a>1</a></xml>", "outro.xml");
    expect(nota).toBeNull();
    expect(erro).toMatch(/não é um XML de NF-e/);
  });

  it("rejeita nota cancelada", () => {
    const cancelada = xmlNota().replace("<cStat>100</cStat>", "<cStat>101</cStat>");
    expect(parseNfeXml(cancelada, "nota.xml").erro).toMatch(/cancelada/);
  });
});

describe("direito a crédito por CST e regime", () => {
  it("credita ICMS tributado no Lucro Real e no Presumido", () => {
    expect(creditaIcms("00", "real")).toBe(true);
    expect(creditaIcms("00", "presumido")).toBe(true);
  });

  it("não credita ICMS no Simples nem no MEI", () => {
    expect(creditaIcms("00", "simples")).toBe(false);
    expect(creditaIcms("00", "mei")).toBe(false);
  });

  it("não credita ICMS quando o fornecedor é do Simples (CSOSN)", () => {
    expect(creditaIcms("102", "real")).toBe(false);
  });

  it("não credita ICMS já retido por substituição (CST 60)", () => {
    expect(creditaIcms("60", "real")).toBe(false);
  });

  it("credita PIS/Cofins só no Lucro Real e com CST tributado", () => {
    expect(creditaPisCofins("01", "real")).toBe(true);
    expect(creditaPisCofins("07", "real")).toBe(false);
    expect(creditaPisCofins("01", "presumido")).toBe(false);
  });
});

describe("precificação da nota inteira", () => {
  const premissas = premissasPadrao({ margemDesejada: 30 });

  it("separa desembolso, crédito e custo líquido no Lucro Real", () => {
    const { nota } = parseNfeXml(xmlNota(), "nota.xml");
    const calc = precificarNota(nota!, { regime: "real", premissas });
    // Desembolso = produtos - desconto + frete (tributos estão incluídos no valor).
    expect(calc.totais.desembolso).toBeCloseTo(2150, 2);
    // Créditos = ICMS dos dois itens + PIS/Cofins do primeiro.
    expect(calc.totais.creditos).toBeCloseTo(452.5, 2);
    expect(calc.totais.custoLiquido).toBeCloseTo(1697.5, 2);
  });

  it("no Simples não há crédito e o custo líquido é o desembolso", () => {
    const { nota } = parseNfeXml(xmlNota(), "nota.xml");
    const calc = precificarNota(nota!, { regime: "simples", premissas });
    expect(calc.totais.creditos).toBe(0);
    expect(calc.totais.custoLiquido).toBeCloseTo(calc.totais.desembolso, 2);
  });

  it("ICMS-ST e IPI aumentam o desembolso sem gerar crédito", () => {
    const { nota } = parseNfeXml(xmlNota({ st: true, ipi: true }), "nota.xml");
    const calc = precificarNota(nota!, { regime: "real", premissas });
    // 2150 + ICMS-ST (100 nos dois itens) + IPI (50, só no primeiro item)
    expect(calc.totais.desembolso).toBeCloseTo(2400, 2);
  });

  it("sugere preço unitário acima do custo líquido do item", () => {
    const { nota } = parseNfeXml(xmlNota(), "nota.xml");
    const calc = precificarNota(nota!, { regime: "real", premissas });
    const primeiro = calc.itens[0];
    expect(primeiro.resultado.recomendado!.precoFinal).toBeGreaterThan(
      primeiro.resultado.compra.custoLiquidoUnitario,
    );
    expect(primeiro.resultado.recomendado!.margemEfetiva).toBeCloseTo(30, 4);
  });
});

describe("leitura assistida do DANFE em PDF", () => {
  const linhas = [
    "FORNECEDOR SP LTDA",
    "Nº 001.234.567 SÉRIE: 1 10/05/2026",
    "A1 CAFE 500G 09012100 00 6102 CX 100,0000 10,0000 1.000,00 1.000,00 180,00 0,00",
    "B2 ACUCAR 1KG 17019900 00 6102 FD 50,0000 20,0000 1.000,00 1.000,00 180,00 0,00",
    "VALOR TOTAL DOS PRODUTOS 2.000,00",
    "VALOR DO FRETE 200,00",
    "VALOR TOTAL DA NOTA 2.200,00",
  ];

  it("reconhece os itens da tabela do DANFE", () => {
    const itens = itensDoTexto(linhas);
    expect(itens).toHaveLength(2);
    expect(itens[0].descricao).toBe("CAFE 500G");
    expect(itens[0].quantidade).toBe(100);
    expect(itens[0].valorProduto).toBe(1000);
  });

  it("monta a nota marcada para conferência e rateia o frete", () => {
    const { nota, erro } = notaDoTextoPdf(linhas, "danfe.pdf");
    expect(erro).toBeNull();
    expect(nota?.confiavel).toBe(false);
    expect(nota?.formato).toBe("pdf");
    expect(nota?.itens[0].frete).toBe(100);
    expect(nota?.avisos.join(" ")).toMatch(/Leitura assistida/);
  });

  it("avisa quando não reconhece nenhum item", () => {
    const { nota, erro } = notaDoTextoPdf(["texto qualquer"], "danfe.pdf");
    expect(nota).toBeNull();
    expect(erro).toMatch(/XML/);
  });
});
