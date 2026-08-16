import { createConnection, type RowDataPacket } from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");

  const connection = await createConnection(url);
  try {
    const [tables] = await connection.query<RowDataPacket[]>("SHOW TABLES");
    console.log("tables", tables);

    for (const table of tables) {
      const tableName = String(Object.values(table)[0]);
      const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
      console.log("count", tableName, Number(rows[0]?.count ?? 0));
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
