import { BADGES } from '../../content/labels';
import type { BadgeId } from '../../types';
import { Icon } from '../ui/Icon';

/** Lista de conquistas. Estado indicado por texto e ícone, não só por cor. */
export function BadgeGrid({ earned, show }: { earned: BadgeId[]; show?: BadgeId[] }) {
  const ids = show ?? (Object.keys(BADGES) as BadgeId[]);
  return (
    <ul className="badges">
      {ids.map((id) => {
        const b = BADGES[id];
        const has = earned.includes(id);
        return (
          <li key={id} className={['badge', has ? 'is-earned' : 'is-locked'].join(' ')}>
            <span className="badge__icon">
              <Icon name={has ? b.icon : 'lock'} size={22} />
            </span>
            <span className="badge__text">
              <span className="badge__title">{b.title}</span>
              <span className="badge__state">{has ? 'Conquistada' : 'Ainda não conquistada'}</span>
              <span className="badge__desc">{b.description}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
