type BrandLogoProps = {
  className?: string;
  iconOnly?: boolean;
};

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`dealivra-mark ${className}`.trim()}
      viewBox="0 0 72 64"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="dealivra-mark-primary"
        d="M26 6H13L2 32l14 26h16L18 32 26 6Z"
      />
      <path
        className="dealivra-mark-accent"
        d="M38 6h16l16 26-15 26H39l6-10 9-16L38 6Z"
      />
    </svg>
  );
}

export function BrandLogo({ className = '', iconOnly = false }: BrandLogoProps) {
  return (
    <span
      className={`dealivra-lockup${iconOnly ? ' icon-only' : ''} ${className}`.trim()}
      aria-label="Dealivra"
    >
      <BrandMark />
      {!iconOnly && <span className="dealivra-wordmark">Dealivra</span>}
    </span>
  );
}
