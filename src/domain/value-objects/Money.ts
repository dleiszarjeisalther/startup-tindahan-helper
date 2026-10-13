// src/domain/value-objects/Money.ts

const phpCurrencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Immutable OOP Value Object for Philippine Peso (₱) arithmetic using integer centavos
 * to eliminate IEEE-754 floating-point rounding bugs during POS checkout, discounts, and split tenders.
 */
export class Money {
  private readonly _centavos: number;

  private constructor(centavos: number) {
    this._centavos = Math.round(centavos);
  }

  public static fromCentavos(centavos: number | null | undefined): Money {
    const numeric = typeof centavos === 'number' ? centavos : Number(centavos ?? 0);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return new Money(0);
    }
    return new Money(numeric);
  }

  public static fromPhp(phpAmount: number | null | undefined): Money {
    const numeric = typeof phpAmount === 'number' ? phpAmount : Number(phpAmount ?? 0);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return new Money(0);
    }
    return new Money(Math.round(numeric * 100));
  }

  public static zero(): Money {
    return new Money(0);
  }

  public get centavos(): number {
    return this._centavos;
  }

  public get php(): number {
    return this._centavos / 100;
  }

  public add(other: Money): Money {
    return new Money(this._centavos + other._centavos);
  }

  public subtract(other: Money): Money {
    return new Money(Math.max(0, this._centavos - other._centavos));
  }

  public multiply(factor: number): Money {
    return new Money(Math.round(this._centavos * factor));
  }

  public format(): string {
    return phpCurrencyFormatter.format(this.php);
  }
}
