import { faker } from '@faker-js/faker';
import type { SearchResult } from '../../src/types/index';

export function seedSuite(seed: number = 12345): void {
  faker.seed(seed);
}

export function userPayload(
  overrides: Partial<{ email: string; name: string; password: string; role: 'admin' | 'user' }> = {}
) {
  const email = `${faker.internet.username().toLowerCase()}+${Date.now()}@example.com`;
  const name = faker.person.fullName().slice(0, 80);
  // Satisfy complexity checks used in controllers
  const password = `Str0ng!${faker.string.alphanumeric({ length: 10, casing: 'mixed' })}`;
  return {
    email: (overrides.email ?? email).toLowerCase(),
    name: overrides.name ?? name,
    password: overrides.password ?? password,
    role: overrides.role ?? 'user',
  };
}

export function apiKeyPayload(
  overrides: Partial<{
    name: string;
    environment: 'test' | 'live';
    permissions: string[];
    rateLimitTier: 'free' | 'pro' | 'enterprise';
    expiresAt?: string;
    rateLimitCustom?: Record<string, any>;
  }> = {}
) {
  return {
    name: overrides.name ?? faker.commerce.productName().slice(0, 60),
    environment: overrides.environment ?? faker.helpers.arrayElement(['test', 'live']),
    permissions: overrides.permissions ?? ['search'],
    rateLimitTier: overrides.rateLimitTier ?? 'free',
    rateLimitCustom: overrides.rateLimitCustom,
    expiresAt: overrides.expiresAt ?? faker.date.soon({ days: 90 }).toISOString(),
  };
}

export function dbConnectionPayload(
  overrides: Partial<{
    name: string;
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
  }> = {}
) {
  return {
    name: overrides.name ?? `DB ${faker.word.words({ count: 2 })}`.slice(0, 60),
    host: overrides.host ?? 'localhost',
    port: overrides.port ?? 3306,
    database: overrides.database ?? 'altus4_test',
    username: overrides.username ?? 'root',
    password: overrides.password ?? '',
    ssl: overrides.ssl ?? false,
  };
}

export function mockSearchResults(count: number = 10): SearchResult[] {
  return Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    table: faker.hacker.noun(),
    database: 'altus4_test',
    relevanceScore: faker.number.float({ min: 0.1, max: 1.0, fractionDigits: 2 }),
    matchedColumns: [faker.database.column(), faker.database.column()],
    data: {
      id: faker.number.int({ min: 1, max: 1000 }),
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(2),
      created_at: faker.date.recent().toISOString(),
    },
    snippet: faker.lorem.sentences(2),
    categories: [faker.hacker.noun(), faker.commerce.department()],
  }));
}
