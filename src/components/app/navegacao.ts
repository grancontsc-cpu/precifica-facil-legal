import {
  Building2,
  Calculator,
  ClipboardList,
  History,
  KeyRound,
  LayoutDashboard,
  Mail,
  MailPlus,
  Package,
  Percent,
  Scale,
  ShieldQuestion,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Acesso = "todos" | "manager" | "super_admin";

export interface ItemNav {
  to: string;
  label: string;
  /** Frase curta em linguagem simples, mostrada no menu completo. */
  descricao: string;
  icon: LucideIcon;
  acesso: Acesso;
}

/** Itens do dia a dia — sempre visíveis. */
export const NAV_DIARIO: ItemNav[] = [
  {
    to: "/simulador",
    label: "Simulador",
    descricao: "Calcule o preço de venda de um produto",
    icon: Calculator,
    acesso: "todos",
  },
  {
    to: "/comparar",
    label: "Comparar",
    descricao: "Veja qual fornecedor sai mais barato de verdade",
    icon: Scale,
    acesso: "todos",
  },
  {
    to: "/simulacoes",
    label: "Simulações",
    descricao: "Histórico dos cálculos já salvos",
    icon: ClipboardList,
    acesso: "todos",
  },
  {
    to: "/produtos",
    label: "Produtos",
    descricao: "Cadastro dos itens que você precifica",
    icon: Package,
    acesso: "todos",
  },
  {
    to: "/perfis",
    label: "Perfis tributários",
    descricao: "Conjuntos de tributos usados nas simulações",
    icon: Percent,
    acesso: "todos",
  },
];

/** Itens de gestão da empresa (gestor). */
export const NAV_GESTAO: ItemNav[] = [
  {
    to: "/gestao",
    label: "Painel da empresa",
    descricao: "Resumo da sua empresa",
    icon: LayoutDashboard,
    acesso: "manager",
  },
  {
    to: "/gestao/usuarios",
    label: "Usuários",
    descricao: "Quem pode usar o sistema na sua empresa",
    icon: Users,
    acesso: "manager",
  },
  {
    to: "/gestao/vinculos",
    label: "Pedidos de vínculo",
    descricao: "Aprove quem pediu acesso à sua empresa",
    icon: UserPlus,
    acesso: "manager",
  },
  {
    to: "/gestao/convites",
    label: "Convites",
    descricao: "Convide pessoas da sua equipe",
    icon: MailPlus,
    acesso: "manager",
  },
];

/** Itens exclusivos do Administrador Geral. */
export const NAV_ADMIN: ItemNav[] = [
  {
    to: "/admin",
    label: "Painel geral",
    descricao: "Visão geral de todas as empresas",
    icon: LayoutDashboard,
    acesso: "super_admin",
  },
  {
    to: "/admin/usuarios",
    label: "Todos os usuários",
    descricao: "Usuários de todas as empresas",
    icon: Users,
    acesso: "super_admin",
  },
  {
    to: "/admin/convites",
    label: "Todos os convites",
    descricao: "Convites enviados no sistema inteiro",
    icon: MailPlus,
    acesso: "super_admin",
  },
  {
    to: "/admin/solicitacoes",
    label: "Solicitações de acesso",
    descricao: "Pedidos aguardando sua resposta",
    icon: ShieldQuestion,
    acesso: "super_admin",
  },
  {
    to: "/admin/emails",
    label: "E-mails",
    descricao: "Teste e histórico dos e-mails do sistema",
    icon: Mail,
    acesso: "super_admin",
  },
  {
    to: "/admin/licencas",
    label: "Licenças",
    descricao: "Liberar, suspender ou estender assinaturas",
    icon: KeyRound,
    acesso: "super_admin",
  },
  {
    to: "/empresas",
    label: "Empresas",
    descricao: "Cadastro das empresas atendidas",
    icon: Building2,
    acesso: "super_admin",
  },
  {
    to: "/auditoria",
    label: "Auditoria",
    descricao: "Quem alterou o quê e quando",
    icon: History,
    acesso: "super_admin",
  },
];

export function itemAtivo(pathname: string, to: string) {
  if (to === "/gestao" || to === "/admin") return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}
