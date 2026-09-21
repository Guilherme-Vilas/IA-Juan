import { authUrlForTenant } from "../src/core/calendar.js";

const slug = process.argv[2] || "juan";
try {
  const url = authUrlForTenant(slug);
  console.log(`\nAbra esta URL no navegador logado na conta Google do tenant ${slug}:\n`);
  console.log(url);
  console.log("\nOu inicie a API e acesse /oauth/google/start\n");
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
