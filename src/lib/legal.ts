export const LEGAL = {
  /** Data controller: the club or association that runs the platform. */
  owner: 'Jorge Manuel Miranda Herrera',
  /** NIF / CIF of the controller. */
  taxId: '',
  /** Postal address. */
  address: '',
  /** Contact email for privacy requests (access, deletion, etc.). */
  email: 'jorgemmirandah@gmail.com',
  /** Data protection officer, if the club has one (optional). */
  dpo: '',
  /** Site name shown in the texts. */
  site: 'Odisea Miranda',
  /** Last update of the texts (YYYY-MM-DD). */
  updated: '2026-10-03',
};

export const PENDING = '(pendiente de completar)';

export function legalField(v: string): string {
  return v.trim() || PENDING;
}

/** Retention: students with no activity for this long can be removed by the club (shown in the policy). */
export const RETENTION_MONTHS = 24;
