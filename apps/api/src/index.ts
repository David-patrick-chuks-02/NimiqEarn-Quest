import "./env.js";
import { buildServer } from "./app.js";
import { startDbKeepalive } from "./db-keepalive.js";

async function start() {
  const { app, env } = await buildServer();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`API listening on http://localhost:${env.PORT}`);
    // Keep free Supabase awake: SELECT 1 shortly after boot, then once per day.
    startDbKeepalive(app.db, app.log);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
