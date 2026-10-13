// src/infrastructure/container.ts
import { InMemoryProductRepository } from './repositories/InMemoryProductRepository';
import { ProductOnboardingService } from '../application/ProductOnboardingService';
import { TindahanStoreService } from '../application/TindahanStoreService';
import { SeasonalForecastEngine } from '../domain/strategies/SeasonalForecastEngine';
import { OpenFoodFactsApiClient } from './services/OpenFoodFactsApiClient';

export const openFoodFactsApiClient = new OpenFoodFactsApiClient();
export const productRepository = new InMemoryProductRepository();
export const productOnboardingService = new ProductOnboardingService(
  productRepository,
  openFoodFactsApiClient
);
export const tindahanStoreService = new TindahanStoreService(
  productRepository,
  productOnboardingService
);
export const seasonalForecastEngine = new SeasonalForecastEngine();
