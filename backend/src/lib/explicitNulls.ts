/**
 * Store unset optional fields as explicit `null`.
 *
 * WHY THIS EXISTS
 *
 * In SQL an optional column that was not supplied IS null, so `where: { x: null }`
 * finds it. In MongoDB, Prisma simply omits the field from the document, and its
 * `x: null` filter then does NOT match — only `x: { isSet: false }` does.
 * Measured against this cluster on a freshly created document:
 *
 *   where: { captain: null }             -> 0 rows
 *   where: { captain: { not: null } }    -> 0 rows
 *   where: { captain: { isSet: false } } -> 1 row
 *
 * This codebase was written against SQL semantics. The soft-delete filter
 * (`deletedAt: null`), "institution-wide" users (`campusId: null`) and dozens of
 * handler-level `null` checks would all silently return nothing. Rewriting every
 * query is not something that stays fixed; writing the null is. With this
 * extension a missing optional field never reaches the database, so `null`
 * filters mean what the rest of the code already assumes they mean.
 *
 * It must sit on the BASE client so no caller — tenant-scoped or not — can
 * create a document without it.
 *
 * KNOWN LIMIT
 *
 * A foreign-key field cannot be set to null in the same `data` that uses
 * relation syntax (`department: { connect: … }`) — Prisma rejects mixing the
 * two input styles. Such an FK is left unset. Creates in this codebase supply
 * foreign keys as scalars, so this is the exception rather than the rule.
 */

import { Prisma } from '@prisma/client';

interface ModelShape {
  /** Optional, non-list scalar/enum fields with no default. */
  optionalScalars: string[];
  /** Scalar fields that are the local side of a relation. */
  foreignKeys: Set<string>;
  /** Relation field name -> target model and the FK fields it owns. */
  relations: Map<string, { target: string; relationName: string; fromFields: string[] }>;
}

const shapes = new Map<string, ModelShape>();

for (const model of Prisma.dmmf.datamodel.models) {
  const shape: ModelShape = { optionalScalars: [], foreignKeys: new Set(), relations: new Map() };

  for (const field of model.fields) {
    if (field.kind === 'object') {
      const fromFields = [...(field.relationFromFields ?? [])];
      shape.relations.set(field.name, {
        target: field.type,
        relationName: field.relationName ?? '',
        fromFields
      });
      for (const fk of fromFields) shape.foreignKeys.add(fk);
    } else if (!field.isRequired && !field.isList && !field.hasDefaultValue && !field.isId) {
      shape.optionalScalars.push(field.name);
    }
  }

  shapes.set(model.name, shape);
}

type Row = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

const each = (value: unknown, visit: (row: Row) => void): void => {
  if (Array.isArray(value)) value.filter(isPlainObject).forEach(visit);
  else if (isPlainObject(value)) visit(value);
};

/** Descend into nested writes, filling every nested create. */
function fillNested(modelName: string, data: Row): void {
  const shape = shapes.get(modelName);
  if (!shape) return;

  for (const [relationField, relation] of shape.relations) {
    const nested = data[relationField];
    if (!isPlainObject(nested)) continue;

    // The child's FK back to this parent is set by Prisma itself and is not a
    // legal key inside a nested create, so it must not be filled.
    const backReference = new Set<string>();
    for (const candidate of shapes.get(relation.target)?.relations.values() ?? []) {
      if (candidate.relationName === relation.relationName && candidate.target === modelName) {
        candidate.fromFields.forEach((fk) => backReference.add(fk));
      }
    }

    const fill = (row: Row) => fillCreate(relation.target, row, backReference);
    const descend = (row: Row) => fillNested(relation.target, row);

    each(nested.create, fill);
    each((nested.createMany as Row | undefined)?.data, fill);
    each(nested.connectOrCreate, (entry) => each(entry.create, fill));
    each(nested.upsert, (entry) => {
      each(entry.create, fill);
      each(entry.update, descend);
    });
    each(nested.update, (entry) => each('data' in entry ? entry.data : entry, descend));
  }
}

/** Fill one create payload in place. */
function fillCreate(modelName: string, data: Row, exclude: Set<string> = new Set()): void {
  const shape = shapes.get(modelName);
  if (!shape) return;

  const usesRelationSyntax = [...shape.relations.keys()].some((name) => data[name] !== undefined);

  for (const field of shape.optionalScalars) {
    if (data[field] !== undefined || exclude.has(field)) continue;
    if (shape.foreignKeys.has(field) && usesRelationSyntax) continue;
    data[field] = null;
  }

  fillNested(modelName, data);
}

export const explicitNullExtension = Prisma.defineExtension({
  name: 'explicit-nulls',
  query: {
    $allModels: {
      async create({ model, args, query }) {
        each(args.data, (row) => fillCreate(model, row));
        return query(args);
      },
      async createMany({ model, args, query }) {
        each(args.data, (row) => fillCreate(model, row));
        return query(args);
      },
      async upsert({ model, args, query }) {
        each(args.create, (row) => fillCreate(model, row));
        each(args.update, (row) => fillNested(model, row));
        return query(args);
      },
      async update({ model, args, query }) {
        each(args.data, (row) => fillNested(model, row));
        return query(args);
      }
    }
  }
});

/** Model name -> optional fields that must be stored as explicit null. */
export function optionalFieldsByModel(): Map<string, string[]> {
  return new Map([...shapes].map(([model, shape]) => [model, [...shape.optionalScalars]]));
}
