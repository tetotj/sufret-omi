import { createConnection, type RowDataPacket } from "mysql2/promise";

async function main() {
  const table = process.argv[2];
  if (!table || !/^[A-Za-z0-9_]+$/.test(table)) throw new Error("Provide a safe table name");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  const connection = await createConnection(url);
  try {
    const [rows] = await connection.query<RowDataPacket[]>(`DESCRIBE \`${table}\``);
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
