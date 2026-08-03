import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarSimulacoes from "./tools/listar-simulacoes";
import detalharSimulacao from "./tools/detalhar-simulacao";
import listarProdutos from "./tools/listar-produtos";
import simularPreco from "./tools/simular-preco";

// O emissor OAuth precisa ser o host direto do backend; o ref do projeto é o
// único valor que sobrevive à publicação sem reescrita.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "precifica-facil",
  title: "Precifica Fácil",
  version: "0.1.0",
  instructions:
    "Ferramentas do Precifica Grancont, simulador gerencial de precificação tributária brasileira. Use `simular_preco` para estimar o preço de venda a partir do valor de compra, do trajeto entre estados e do regime tributário; `listar_produtos`, `listar_simulacoes` e `detalhar_simulacao` para consultar os dados da empresa do usuário. Todos os valores respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [simularPreco, listarProdutos, listarSimulacoes, detalharSimulacao],
});
