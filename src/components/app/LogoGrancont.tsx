/** Marca da Grancont usada no cabeçalho do relatório e no app. */
export function LogoGrancont({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 48"
      role="img"
      aria-label="Grancont"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="46" height="46" rx="12" fill="currentColor" opacity="0.12" />
      <path
        d="M14 32V16h9.5a5.5 5.5 0 0 1 0 11H20l6 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33.5" cy="19" r="2.6" fill="currentColor" />
      <text
        x="58"
        y="24"
        fontFamily="inherit"
        fontSize="19"
        fontWeight="700"
        fill="currentColor"
        dominantBaseline="middle"
      >
        GRANCONT
      </text>
      <text x="58" y="39" fontFamily="inherit" fontSize="9.5" fill="currentColor" opacity="0.7">
        Contabilidade e inteligência fiscal
      </text>
    </svg>
  );
}
