import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function collectEnvPaths(startDir: string): string[] {
  const paths: string[] = [];
  let dir = startDir;

  while (true) {
    paths.push(resolve(dir, ".env"));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return paths;
}

/** Load `.env` from the monorepo root (walks up from cwd and the entry module). */
export function loadRootEnv(entryMetaUrl?: string): void {
  const paths = new Set<string>();

  if (entryMetaUrl) {
    for (const path of collectEnvPaths(dirname(fileURLToPath(entryMetaUrl)))) {
      paths.add(path);
    }
  }

  for (const path of collectEnvPaths(process.cwd())) {
    paths.add(path);
  }

  for (const path of paths) {
    if (existsSync(path)) {
      config({ path });
      return;
    }
  }
}
