// src/domain/repositories/IProductRepository.ts
import { Product } from '../entities/Product';
import { Barcode } from '../value-objects/Barcode';

export interface IProductRepository {
  getAll(): Promise<Product[]>;
  findByBarcode(barcode: Barcode): Promise<Product | null>;
  save(product: Product): Promise<void>;
  deleteById(id: string): Promise<void>;
  getNextTingiSequence(): Promise<number>;
}
