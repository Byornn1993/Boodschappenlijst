// PGlite (Postgres in het geheugen) voor de migratietests.
// Eerst uit tools/node_modules (na `npm install` in tools/), anders uit de map van Be Strong ernaast.
export async function loadPGlite() {
  try {
    return (await import('@electric-sql/pglite')).PGlite;
  } catch {
    const url = new URL('../../../Be strong/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url);
    return (await import(url.href)).PGlite;
  }
}
