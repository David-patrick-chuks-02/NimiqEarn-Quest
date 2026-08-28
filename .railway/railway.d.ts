// Ambient type declarations for Railway's Infrastructure-as-Code DSL.
//
// The real `railway/iac` module is injected by the Railway CLI when it evaluates
// `.railway/railway.ts` (via `railway config plan/apply`) and is therefore never
// present in node_modules. These declarations only exist so the editor and
// type-checker can validate `railway.ts` — they are ignored by the CLI, which
// uses its own bundled implementation.
declare module "railway/iac" {
  export interface RailwayContext {
    command: string;
    projectId: string;
    projectName: string;
    environmentId: string;
    environment: string;
    environmentName: string;
    isEnvironment(name: string): boolean;
    shared: Record<string, string>;
  }

  export interface GithubSourceOptions {
    branch?: string;
    rootDirectory?: string;
  }

  export interface GithubSource {
    repo: string;
    branch?: string;
    rootDirectory?: string;
  }

  export function github(repo: string, options?: GithubSourceOptions): GithubSource;

  export function preserve(): string;

  export interface EnvRef {
    [key: string]: string;
    RAILWAY_PRIVATE_DOMAIN: string;
  }

  export interface ServiceConfig {
    source?: GithubSource;
    build?: string;
    start?: string;
    healthcheck?: string;
    healthcheckTimeout?: number;
    replicas?: number | Record<string, number>;
    domains?: Array<string | { domain: string; port?: number }>;
    env?: Record<string, string>;
    volumeMounts?: Record<string, unknown>;
  }

  export interface ServiceRef {
    env: EnvRef;
  }

  export function service(name: string, config?: ServiceConfig): ServiceRef;

  export interface DatabaseRef {
    env: EnvRef & { DATABASE_URL: string };
  }

  export function postgres(name: string): DatabaseRef;

  export interface RedisRef {
    env: EnvRef & { REDIS_URL: string };
  }

  export function redis(name: string): RedisRef;

  export function group(name: string, resources: unknown[]): unknown;

  export function project(name: string, config: { resources: unknown[] }): unknown;

  export function defineRailway(fn: (ctx: RailwayContext) => unknown): unknown;
}
