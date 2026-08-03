import logoRoxo from "@/assets/grancont-roxo.png.asset.json";
import logoBranca from "@/assets/grancont-branca.png.asset.json";

/** Marca oficial da Grancont usada no cabeçalho do relatório e no app. */
export function LogoGrancont({
  className = "h-10 w-auto",
  variante = "auto",
}: {
  className?: string;
  /** "auto" alterna conforme o tema; "clara" força a versão branca. */
  variante?: "auto" | "clara" | "escura";
}) {
  const alt = "Grancont — soluções contábeis";

  if (variante === "clara") {
    return <img src={logoBranca.url} alt={alt} className={className} />;
  }
  if (variante === "escura") {
    return <img src={logoRoxo.url} alt={alt} className={className} />;
  }

  return (
    <>
      <img src={logoRoxo.url} alt={alt} className={`${className} dark:hidden`} />
      <img src={logoBranca.url} alt={alt} className={`${className} hidden dark:block`} />
    </>
  );
}
