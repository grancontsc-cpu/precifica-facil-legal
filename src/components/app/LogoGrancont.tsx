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
  // `shrink-0` evita que o iOS Safari comprima a imagem dentro de flex
  // containers; width/height intrínsecos reservam a proporção antes do load
  // (evita salto de layout no Chrome Android e altura 0 no WebKit).
  const base = "block w-auto max-w-full shrink-0 select-none object-contain";
  const dimensoes = { width: 1268, height: 300 };
  const acessibilidade = decorativa
    ? ({ alt: "", "aria-hidden": true as const, role: "presentation" as const })
    : { alt };

  if (variante === "clara") {
    return (
      <img
        src={logoBranca.url}
        {...dimensoes}
        {...acessibilidade}
        className={`${base} ${className}`}
      />
    );
  }
  if (variante === "escura") {
    return (
      <img src={logoRoxo.url} {...dimensoes} {...acessibilidade} className={`${base} ${className}`} />
    );
  }

  // As duas versões usam o mesmo texto alternativo: a oculta usa `display:none`,
  // que leitores de tela ignoram — não há leitura duplicada.
  return (
    <>
      <img
        src={logoRoxo.url}
        {...dimensoes}
        {...acessibilidade}
        className={`${base} ${className} dark:hidden`}
      />
      <img
        src={logoBranca.url}
        {...dimensoes}
        {...acessibilidade}
        className={`${base} ${className} hidden dark:block`}
      />
    </>


  );
}
