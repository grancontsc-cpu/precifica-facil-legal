import { Building2, Copy, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface OpcaoSimples {
  id: string;
  rotulo: string;
}

interface Props {
  titulo: string;
  onTitulo: (v: string) => void;
  perfis: OpcaoSimples[];
  perfilId: string | null;
  onPerfil: (id: string) => void;
  produtos: OpcaoSimples[];
  produtoId: string | null;
  onProduto: (id: string) => void;
  camposAlterados: string[];
  camposBloqueados: string[];
  podeEditar: boolean;
  salvando: boolean;
  onSalvar: () => void;
  onDuplicar: () => void;
  simulacaoSalva: boolean;
  acoes?: React.ReactNode;
}

export function BarraSimulacao({
  titulo,
  onTitulo,
  perfis,
  perfilId,
  onPerfil,
  produtos,
  produtoId,
  onProduto,
  camposAlterados,
  camposBloqueados,
  podeEditar,
  salvando,
  onSalvar,
  onDuplicar,
  simulacaoSalva,
}: Props) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="sim-titulo">Nome da simulação</Label>
          <Input
            id="sim-titulo"
            value={titulo}
            maxLength={140}
            disabled={!podeEditar}
            onChange={(e) => onTitulo(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Perfil tributário</Label>
          <Select value={perfilId ?? "manual"} onValueChange={onPerfil} disabled={!podeEditar}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Configuração manual</SelectItem>
              {perfis.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Produto</Label>
          <Select value={produtoId ?? "avulso"} onValueChange={onProduto} disabled={!podeEditar}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="avulso">Produto avulso</SelectItem>
              {produtos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          {simulacaoSalva && podeEditar ? (
            <Button variant="outline" size="sm" onClick={onDuplicar}>
              <Copy className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Duplicar</span>
            </Button>
          ) : null}
          <Button size="sm" onClick={onSalvar} disabled={!podeEditar || salvando}>
            <Save className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{simulacaoSalva ? "Salvar alterações" : "Salvar simulação"}</span>
          </Button>
        </div>
      </div>

      {camposBloqueados.length > 0 || camposAlterados.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          {camposBloqueados.length > 0 ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              Bloqueado pela Grancont:
            </span>
          ) : null}
          {camposBloqueados.map((c) => (
            <Badge key={c} variant="outline">
              {c}
            </Badge>
          ))}
          {camposAlterados.length > 0 ? (
            <>
              <span className="ml-2 text-muted-foreground">Alterado manualmente:</span>
              {camposAlterados.map((c) => (
                <Badge key={c} className="bg-warning/15 text-warning-foreground" variant="secondary">
                  {c}
                </Badge>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
