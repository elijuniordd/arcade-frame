import type { AvatarSpec } from '../../types';

/** Ilustração leve de personagem em SVG (decorativa: o nome sempre aparece em texto ao lado). */
export function Avatar({ spec, size = 96, className }: { spec: AvatarSpec; size?: number; className?: string }) {
  const { skin, hair, hairStyle, shirt, glasses } = spec;
  return (
    <svg className={['avatar', className].filter(Boolean).join(' ')} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="120" height="120" fill="#2A1A45" />
      <path d="M0 96h120M0 72h120M24 0v120M48 0v120M72 0v120M96 0v120" stroke="#3B2860" strokeWidth="1" />
      {hairStyle === 'longo' && <path d="M30 48c0-22 60-22 60 0v40H30z" fill={hair} />}
      <path d="M18 120c2-22 20-32 42-32s40 10 42 32z" fill={shirt} />
      <path d="M50 78h20v14c-6 4-14 4-20 0z" fill={skin} />
      <ellipse cx="60" cy="56" rx="22" ry="25" fill={skin} />
      {hairStyle === 'coque' && (
        <>
          <circle cx="60" cy="25" r="10" fill={hair} />
          <path d="M37 52c0-20 10-27 23-27s23 7 23 27c-5-10-13-14-23-14s-18 4-23 14z" fill={hair} />
        </>
      )}
      {hairStyle === 'curto' && <path d="M37 50c0-18 9-25 23-25s23 7 23 25c-6-8-14-11-23-11s-17 3-23 11z" fill={hair} />}
      {hairStyle === 'cacheado' && (
        <g fill={hair}>
          <circle cx="44" cy="38" r="9" />
          <circle cx="56" cy="31" r="10" />
          <circle cx="69" cy="32" r="10" />
          <circle cx="78" cy="41" r="8" />
          <circle cx="40" cy="48" r="6" />
          <circle cx="81" cy="50" r="5" />
        </g>
      )}
      {hairStyle === 'longo' && <path d="M37 52c0-20 10-28 23-28s23 8 23 28c-8-9-15-13-23-13s-15 4-23 13z" fill={hair} />}
      <rect x="49" y="55" width="5" height="5" fill="#1B1030" />
      <rect x="66" y="55" width="5" height="5" fill="#1B1030" />
      {glasses && (
        <g stroke="#1B1030" strokeWidth="2.2" fill="none">
          <rect x="44" y="51" width="14" height="12" />
          <rect x="62" y="51" width="14" height="12" />
          <path d="M58 56h4" />
        </g>
      )}
      <path d="M52 69c4 4 12 4 16 0" stroke="#1B1030" strokeWidth="2.5" fill="none" strokeLinecap="square" />
    </svg>
  );
}
