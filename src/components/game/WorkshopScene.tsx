/**
 * Ilustração da oficina. Cada cenário concluído traz uma melhoria visual discreta:
 * prateleira organizada, mural de turmas e quadro de horários. Concluir tudo acende o letreiro.
 */
export function WorkshopScene({ doacoes, vagas, agenda, all }: { doacoes: boolean; vagas: boolean; agenda: boolean; all: boolean }) {
  const dim = '#3B2860';
  const line = '#655473';
  return (
    <svg className="scene" viewBox="0 0 640 240" role="img" aria-labelledby="scene-title scene-desc" preserveAspectRatio="xMidYMid meet">
      <title id="scene-title">Ilustração da oficina do bairro</title>
      <desc id="scene-desc">
        {`Prateleira de doações ${doacoes ? 'organizada' : 'ainda bagunçada'}; mural de turmas ${vagas ? 'atualizado' : 'vazio'}; quadro de horários ${agenda ? 'iluminado' : 'apagado'}.`}
      </desc>
      <rect width="640" height="240" fill="#1B1030" />
      <g stroke="#2A1A45" strokeWidth="1">
        {Array.from({ length: 16 }, (_, i) => (
          <path key={`v${i}`} d={`M${i * 40} 0v196`} />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${i * 40}h640`} />
        ))}
      </g>
      <rect y="196" width="640" height="44" fill="#100621" />
      <path d="M0 196h640" stroke={line} strokeWidth="3" />

      {/* Letreiro */}
      <rect x="250" y="14" width="140" height="30" fill={all ? '#EFBA3D' : dim} />
      <text x="320" y="34" textAnchor="middle" fontFamily="'Pixelify Sans', monospace" fontWeight="600" fontSize="16" fill={all ? '#100621' : '#9C8AB0'}>
        OFICINA
      </text>
      {all &&
        [270, 300, 330, 360, 390].map((x, i) => <circle key={x} cx={x - 10} cy="56" r="4" fill={['#E3FF72', '#38BDBB', '#EB315D', '#B49ADD', '#EFBA3D'][i]} />)}

      {/* Prateleira de doações */}
      <g>
        <path d="M40 90h150M40 140h150M40 190h150M44 80v116M186 80v116" stroke={line} strokeWidth="4" />
        {doacoes ? (
          <g>
            {[0, 1, 2].map((i) => (
              <g key={`a${i}`}>
                <rect x={52 + i * 44} y="104" width="36" height="34" fill="#EFBA3D" />
                <rect x={60 + i * 44} y="114" width="20" height="8" fill="#100621" />
              </g>
            ))}
            {[0, 1, 2].map((i) => (
              <g key={`b${i}`}>
                <rect x={52 + i * 44} y="154" width="36" height="34" fill="#38BDBB" />
                <rect x={60 + i * 44} y="164" width="20" height="8" fill="#100621" />
              </g>
            ))}
          </g>
        ) : (
          <g fill={dim}>
            <rect x="56" y="110" width="30" height="28" transform="rotate(-8 71 124)" />
            <rect x="120" y="160" width="36" height="28" />
            <rect x="96" y="168" width="22" height="20" transform="rotate(10 107 178)" />
          </g>
        )}
      </g>

      {/* Bancada com computador */}
      <g>
        <rect x="250" y="150" width="140" height="10" fill="#B49ADD" />
        <path d="M262 160v36M378 160v36" stroke="#B49ADD" strokeWidth="6" />
        <rect x="282" y="104" width="76" height="46" fill="#100621" stroke="#38BDBB" strokeWidth="4" />
        <path d="M292 118h30M292 128h46M292 138h22" stroke="#E3FF72" strokeWidth="4" />
      </g>

      {/* Mural de turmas */}
      <g>
        <rect x="430" y="70" width="80" height="90" fill={vagas ? '#542D6D' : dim} stroke={line} strokeWidth="4" />
        {vagas ? (
          <g>
            <rect x="440" y="80" width="26" height="22" fill="#E3FF72" />
            <rect x="474" y="80" width="26" height="22" fill="#EFBA3D" />
            <rect x="440" y="110" width="26" height="22" fill="#38BDBB" />
            <rect x="474" y="110" width="26" height="22" fill="#B49ADD" />
            <path d="M444 92l5 5 10-10" stroke="#100621" strokeWidth="3" fill="none" />
            <path d="M440 142h60" stroke="#F8F5FC" strokeWidth="4" />
          </g>
        ) : (
          <rect x="456" y="96" width="26" height="22" fill="#4A3A63" transform="rotate(6 469 107)" />
        )}
      </g>

      {/* Quadro de horários */}
      <g>
        <rect x="540" y="70" width="80" height="90" fill="#100621" stroke={line} strokeWidth="4" />
        {Array.from({ length: 4 }, (_, r) =>
          Array.from({ length: 3 }, (_, c) => {
            const lit = agenda && (r + c) % 2 === 0;
            return <rect key={`${r}-${c}`} x={550 + c * 22} y={80 + r * 18} width="16" height="12" fill={lit ? ['#38BDBB', '#EFBA3D', '#E3FF72'][c] : agenda ? '#542D6D' : dim} />;
          }),
        )}
      </g>
    </svg>
  );
}
