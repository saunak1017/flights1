import { DatabaseSync } from "node:sqlite";
// Local-only adapter: runs the same SQL/API as Cloudflare D1, without a cloud account.
export function localDB(filename = ":memory:") {
  const db = new DatabaseSync(filename);
  const prepare = (sql) => {
    let params = [];
    const obj = {
      bind(...values) {
        params = values;
        return obj;
      },
      async first() {
        return db.prepare(sql).get(...params) || null;
      },
      async all() {
        return { results: db.prepare(sql).all(...params) };
      },
      async run() {
        const r = db.prepare(sql).run(...params);
        return { success: true, meta: { changes: r.changes } };
      },
    };
    return obj;
  };
  return {
    prepare,
    exec: (sql) => db.exec(sql),
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const result = [];
        for (const s of statements) result.push(await s.run());
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    close: () => db.close(),
  };
}
