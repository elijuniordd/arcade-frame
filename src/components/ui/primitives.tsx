import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------------ */
/* Botões                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: IconName;
  iconAfter?: IconName;
  small?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', icon, iconAfter, small, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={['btn', `btn--${variant}`, small && 'btn--small', className].filter(Boolean).join(' ')} {...rest}>
      {icon && <Icon name={icon} size={small ? 18 : 20} />}
      <span>{children}</span>
      {iconAfter && <Icon name={iconAfter} size={small ? 18 : 20} />}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Etiquetas e rótulos                                                 */
/* ------------------------------------------------------------------ */

export type TagColor = 'yellow' | 'teal' | 'lime' | 'lilac' | 'pink' | 'orange' | 'blue' | 'white' | 'outline';

export function Tag({ color = 'yellow', tilt = 0, children, icon, className }: { color?: TagColor; tilt?: -2 | -1 | 0 | 1 | 2; children: ReactNode; icon?: IconName; className?: string }) {
  return (
    <span className={['tag', `tag--${color}`, tilt !== 0 && `tag--tilt${tilt}`, className].filter(Boolean).join(' ')}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

/** Indicador curto em fonte pixel (nunca usar em parágrafos). */
export function Pixel({ children, color = 'teal', as: As = 'p', className }: { children: ReactNode; color?: 'teal' | 'yellow' | 'lilac' | 'lime'; as?: 'p' | 'span'; className?: string }) {
  return <As className={['pixel', `pixel--${color}`, className].filter(Boolean).join(' ')}>{children}</As>;
}

/* ------------------------------------------------------------------ */
/* Painéis                                                             */
/* ------------------------------------------------------------------ */

export function Panel({
  children,
  variant = 'surface',
  className,
  as: As = 'section',
  labelledBy,
  label,
}: {
  children: ReactNode;
  variant?: 'surface' | 'section' | 'guide' | 'success' | 'alert' | 'ai';
  className?: string;
  as?: 'section' | 'div' | 'aside';
  labelledBy?: string;
  label?: string;
}) {
  return (
    <As className={['panel', `panel--${variant}`, className].filter(Boolean).join(' ')} aria-labelledby={labelledBy} aria-label={label}>
      {children}
    </As>
  );
}

/** Aviso com texto e ícone (nunca só cor). */
export function Notice({ tone, children, title, onClose }: { tone: 'info' | 'alert' | 'success'; title?: string; children: ReactNode; onClose?: () => void }) {
  const icon: IconName = tone === 'alert' ? 'alert' : tone === 'success' ? 'check' : 'info';
  return (
    <div className={`notice notice--${tone}`}>
      <Icon name={icon} size={22} className="notice__icon" />
      <div className="notice__body">
        {title && <p className="notice__title">{title}</p>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button type="button" className="notice__close" onClick={onClose} aria-label="Fechar aviso">
          <Icon name="x" size={18} />
        </button>
      )}
    </div>
  );
}
