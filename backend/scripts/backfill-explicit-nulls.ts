/**
 * Backfill explicit nulls.
 *
 *   npm run db:backfill-nulls
 *
 * `lib/explicitNulls.ts` guarantees that documents written through Prisma store
 * unset optional fields as `null`. This script brings every OTHER document up
 * to that standard: ones written before the extension existed, imported with
 * mongoimport/mongorestore from elsewhere, or edited by hand in Atlas.
 *
 * It only ADDS a missing field as null. `$ifNull` keeps any existing value, so
 * it is safe to run repeatedly and never changes data that is already present.
 */

import { basePrisma } from '../src/lib/prisma.js';
import { optionalFieldsByModel } from '../src/lib/explicitNulls.js';

async function main() {
  let touched = 0;

  for (const [model, fields] of optionalFieldsByModel()) {
    if (fields.length === 0) continue;

    const missing = { $or: fields.map((field) => ({ [field]: { $exists: false } })) };
    const set = Object.fromEntries(fields.map((field) => [field, { $ifNull: [`$${field}`, null] }]));

    const result = (await basePrisma.$runCommandRaw({
      update: model,
      updates: [{ q: missing, u: [{ $set: set }], multi: true }]
    })) as { nModified?: number };

    if (result.nModified) {
      console.log(`  ${model.padEnd(32)} ${result.nModified} document(s) normalised`);
      touched += result.nModified;
    }
  }

  console.log(touched === 0 ? 'Nothing to do — every document already stores explicit nulls.' : `Done. ${touched} document(s) normalised.`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => basePrisma.$disconnect());
