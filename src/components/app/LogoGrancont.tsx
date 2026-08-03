import logoRoxo from "@/assets/grancont-roxo.png.asset.json";
import logoBranca from "@/assets/grancont-branca.png.asset.json";

const ALT_PADRAO = "Grancont Soluções Contábeis";

/** Marca oficial da Grancont usada no cabeçalho do relatório e no app. */
export function LogoGrancont({
  className = "h-10 w-auto",
  variante = "auto",
  alt = ALT_PADRAO,
  decorativa = false,
}: {
  className?: string;
  /** "auto" alterna conforme o tema; "clara" força a versão branca. */
  variante?: "auto" | "clara" | "escura";
  /** Texto alternativo lido por leitores de tela. */
  alt?: string;
  /**
   * Marca como puramente decorativa (alt vazio + aria-hidden). Usar quando a
   * logo está dentro de um link/cabeçalho que já tem nome acessível próprio,
   * evitando leitura duplicada.
   */
  decorativa?: boolean;
}) {
  const base = "block w-auto max-w-full select-none object-contain";
  const acessibilidade = decorativa
    ? ({ alt: "", "aria-hidden": true as const, role: "presentation" as const })
    : { alt };

  if (variante === "clara") {
    return <img src={logoBranca.url} {...acessibilidade} className={`${base} ${className}`} />;
  }
  if (variante === "escura") {
    return <img src={logoRoxo.url} {...acessibilidade} className={`${base} ${className}`} />;
  }

  return (
    <>
      <img
        src={logoRoxo.url}
        {...acessibilidade}
        className={`${base} ${className} dark:hidden`}
      />
      {/* A versão do tema oculto é sempre decorativa: evita nome duplicado. */}
      <img
        src={logoBranca.url}
        alt=""
        aria-hidden
        role="presentation"
        className={`${base} ${className} hidden dark:block`}
      />
    </>
  );
}
