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

  public static fromCentavos(centavos: number): Money {
    return new Money(centavos);
  }

  public static fromPhp(phpAmount: number): Money {
    if (!Number.isFinite(phpAmount) || phpAmount < 0) {
      throw new Error('Money amount must be a valid non-negative number.');
    }
    return new Money(Math.round(phpAmount * 100));
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
