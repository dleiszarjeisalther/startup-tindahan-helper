// src/infrastructure/container.ts
import { InMemoryProductRepository } from './repositories/InMemoryProductRepository';
import { ProductOnboardingService } from '../application/ProductOnboardingService';
import { TindahanStoreService } from '../application/TindahanStoreService';
import { SeasonalForecastEngine } from '../domain/strategies/SeasonalForecastEngine';
import { OpenFoodFactsApiClient } from './services/OpenFoodFactsApiClient';
import { ExpoLocalNotificationScheduler } from './services/ExpoLocalNotificationScheduler';

export const openFoodFactsApiClient = new OpenFoodFactsApiClient();
export const productRepository = new InMemoryProductRepository();
export const productOnboardingService = new ProductOnboardingService(
  productRepository,
  openFoodFactsApiClient
);
export const localNotificationScheduler = new ExpoLocalNotificationScheduler();
export const tindahanStoreService = new TindahanStoreService(
  productRepository,
  productOnboardingService,
  localNotificationScheduler
);
export const seasonalForecastEngine = new SeasonalForecastEngine();
