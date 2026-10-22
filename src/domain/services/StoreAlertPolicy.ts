import { Money } from '../value-objects/Money';

export type StoreAlertKind = 'LOW_STOCK' | 'OVERDUE_UTANG';
export type StoreAlertSeverity = 'WARNING' | 'CRITICAL';

export interface StoreAlert {
  id: string;
  kind: StoreAlertKind;
  severity: StoreAlertSeverity;
  sourceId: string;
  title: string;
  message: string;
  targetRoute: '/inventory' | '/utang';
  balanceCentavos?: number;
  effectiveDueAt?: string;
  isRead: boolean;
}

export interface ProductAlertSource {
  id: string;
  name: string;
  stockCount: number;
  lowStockThreshold: number;
}

export interface UtangAlertSource {
  id: string;
  name: string;
  balanceCentavos: number;
  dueDate?: string;
  debtStartedAt: string;
}

export interface StoreAlertPolicyInput {
  products: readonly ProductAlertSource[];
  utangCustomers: readonly UtangAlertSource[];
  readAlertIds?: ReadonlySet<string>;
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDueAt(customer: UtangAlertSource): Date {
  if (customer.dueDate) {
    const explicit = new Date(`${customer.dueDate}T23:59:59.999`);
    if (!Number.isNaN(explicit.getTime())) return explicit;
  }

  const startedAt = new Date(customer.debtStartedAt);
  const stableStart = Number.isNaN(startedAt.getTime()) ? new Date(0) : startedAt;
  return new Date(stableStart.getTime() + 7 * DAY_MS);
}

/** Pure, framework-agnostic alert evaluation for the current store state. */
export class StoreAlertPolicy {
  public static evaluate(input: StoreAlertPolicyInput): StoreAlert[] {
    const now = input.now ?? new Date();
    const readIds = input.readAlertIds ?? new Set<string>();
    const alerts: StoreAlert[] = [];

    for (const product of input.products) {
      if (product.stockCount > product.lowStockThreshold) continue;
      const id = `LOW_STOCK:${product.id}`;
      alerts.push({
        id,
        kind: 'LOW_STOCK',
        severity: product.stockCount <= 0 ? 'CRITICAL' : 'WARNING',
        sourceId: product.id,
        title: product.stockCount <= 0 ? 'Ubos na ang stock' : 'Mababa na ang stock',
        message:
          product.stockCount <= 0
            ? `Ubos na ang ${product.name}.`
            : `${product.stockCount} na lang ang ${product.name}; reorder level ay ${product.lowStockThreshold}.`,
        targetRoute: '/inventory',
        isRead: readIds.has(id),
      });
    }

    for (const customer of input.utangCustomers) {
      if (customer.balanceCentavos <= 0) continue;
      const dueAt = parseDueAt(customer);
      if (now.getTime() <= dueAt.getTime()) continue;
      const id = `OVERDUE_UTANG:${customer.id}`;
      alerts.push({
        id,
        kind: 'OVERDUE_UTANG',
        severity: 'WARNING',
        sourceId: customer.id,
        title: 'Overdue na utang',
        message: `${customer.name}: ${Money.fromCentavos(customer.balanceCentavos).format()} ang dapat kolektahin.`,
        targetRoute: '/utang',
        balanceCentavos: customer.balanceCentavos,
        effectiveDueAt: dueAt.toISOString(),
        isRead: readIds.has(id),
      });
    }

    return alerts.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'CRITICAL' ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }
}
