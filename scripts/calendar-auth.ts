import { authUrl } from "../src/core/calendar.js";

try {
  const url = authUrl();
  console.log("\nAbra esta URL no navegador logado na conta Google do Juan:\n");
  console.log(url);
  console.log("\nOu inicie a API e acesse /oauth/google/start\n");
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
