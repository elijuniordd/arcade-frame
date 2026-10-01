/** Marca tipográfica própria do jogo: “OFICINA” em pixel + “DO AMANHÃ” em display, com bloco de ferramenta. */
export function Brand({ size = 'small' }: { size?: 'small' | 'large' }) {
  return (
    <span className={`brand brand--${size}`}>
      <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect x="2" y="2" width="28" height="28" fill="#100621" stroke="#EFBA3D" strokeWidth="3" />
        <rect x="9" y="9" width="6" height="6" fill="#38BDBB" />
        <rect x="17" y="9" width="6" height="6" fill="#E3FF72" />
        <rect x="9" y="17" width="6" height="6" fill="#B49ADD" />
        <rect x="17" y="17" width="6" height="6" fill="#EFBA3D" />
      </svg>
      <span className="brand__text">
        <span className="brand__top">OFICINA</span>
        <span className="brand__bottom">DO AMANHÃ</span>
      </span>
    </span>
  );
}
