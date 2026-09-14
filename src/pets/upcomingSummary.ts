import { Vaccine } from '../types/vaccine';

export function getNextDue(vaccines: Vaccine[], now: number): { label: string; overdue: boolean } | null {
  const dated = vaccines.filter((v): v is Vaccine & { nextDueDate: number } => v.nextDueDate != null);
  if (dated.length === 0) return null;

  const nearest = dated.reduce((closest, v) =>
    Math.abs(v.nextDueDate - now) < Math.abs(closest.nextDueDate - now) ? v : closest
  );
  const overdue = nearest.nextDueDate < now;
  return { label: `${nearest.name} ${overdue ? 'overdue' : 'due'}`, overdue };
}
