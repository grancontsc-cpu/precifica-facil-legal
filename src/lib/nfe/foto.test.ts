import { describe, it, expect } from "vitest";
import { notaDaFoto, type NotaExtraida } from "./foto";

const trib = { cst: null, aliquota: null, valor: null };
const base: NotaExtraida = {
  legivel: true,
  numero: "000.123",
  emissao: "10/10/2026",
  emitenteNome: "Fornecedor",
  emitenteCnpj: "12.345.678/0001-90",
  emitenteUf: "sc",
  destinatarioCnpj: null,
  frete: 10,
  desconto: null,
  seguro: null,
  outras: null,
  valorTotalNota: null,
  itens: [
    {
      descricao: "Parafuso",
      codigo: "1",
      ncm: "7318.15.00",
      cfop: "5102",
      unidade: "UN",
      quantidade: 10,
      valorUnitario: 2,
      valorTotal: null,
      icms: { cst: "00", aliquota: 17, valor: 3.4 },
      ipi: trib,
      pis: trib,
      cofins: trib,
      icmsSt: null,
    },
    {
      descricao: "Sem valor",
      codigo: null,
      ncm: null,
      cfop: null,
      unidade: null,
      quantidade: 1,
      valorUnitario: null,
      valorTotal: null,
      icms: trib,
      ipi: trib,
      pis: trib,
      cofins: trib,
      icmsSt: null,
    },
  ],
};

describe("leitura por foto", () => {
  it("calcula total do item e descarta item sem valor", () => {
    const { nota } = notaDaFoto(base, "f.jpg");
    expect(nota!.itens).toHaveLength(1);
    expect(nota!.itens[0].valorProduto).toBe(20);
    expect(nota!.itens[0].ncm).toBe("73181500");
    expect(nota!.confiavel).toBe(false);
    expect(nota!.totais.nota).toBe(30);
    expect(nota!.emitente.uf).toBe("SC");
  });
  it("foto ilegível vira erro", () => {
    expect(notaDaFoto({ ...base, legivel: false }, "f.jpg").nota).toBeNull();
  });
});
