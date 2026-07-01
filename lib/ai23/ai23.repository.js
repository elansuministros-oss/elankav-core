import { AI23_TABLES } from "./ai23.constants.js";
import { createAI23Client } from "./ai23.client.js";

function getClient(client) {
  return client || createAI23Client();
}

function createTableRepository(db, tableName) {
  return {
    async list(filters = {}, options = {}) {
      let query = db.from(tableName).select(options.select || "*");

      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== "") {
          query = query.eq(key, value);
        }
      }

      if (options.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.ascending !== false
        });
      }

      if (Number.isInteger(options.limit) && options.limit > 0) {
        query = query.limit(options.limit);
      }

      return query;
    },

    async getById(id, select = "*") {
      return db
        .from(tableName)
        .select(select)
        .eq("id", id)
        .single();
    },

    async create(payload) {
      return db
        .from(tableName)
        .insert(payload)
        .select()
        .single();
    },

    async update(id, payload) {
      return db
        .from(tableName)
        .update(payload)
        .eq("id", id)
        .select()
        .single();
    },

    async remove(id) {
      return db
        .from(tableName)
        .delete()
        .eq("id", id)
        .select()
        .single();
    }
  };
}

export function createAI23Repository(client = null) {
  const db = getClient(client);

  return {
    componentes: createTableRepository(db, AI23_TABLES.componentes),
    combinaciones: createTableRepository(db, AI23_TABLES.combinaciones),
    combinacionComponentes: createTableRepository(
      db,
      AI23_TABLES.combinacionComponentes
    ),
    adicionales: createTableRepository(db, AI23_TABLES.adicionales),
    costosReferencia: createTableRepository(
      db,
      AI23_TABLES.costosReferencia
    )
  };
}