import { createConnection, type RowDataPacket } from "mysql2/promise";

const queries = [
  ["indexes_orders", "SHOW INDEX FROM `orders`"],
  ["indexes_driverLocations", "SHOW INDEX FROM `driverLocations`"],
  ["indexes_userProfiles", "SHOW INDEX FROM `userProfiles`"],
  ["indexes_announcements", "SHOW INDEX FROM `announcements`"],
  ["explain_orders_customer", "EXPLAIN SELECT * FROM `orders` WHERE `customerId` = 1 ORDER BY `createdAt` DESC LIMIT 50"],
  ["explain_driver_location", "EXPLAIN SELECT * FROM `driverLocations` WHERE `orderId` = 'audit-order' ORDER BY `capturedAt` DESC LIMIT 1"],
  ["explain_announcements", "EXPLAIN SELECT * FROM `announcements` WHERE `isActive` = 1 ORDER BY `sortOrder` ASC"],
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  const connection = await createConnection(url);
  try {
    for (const [name, query] of queries) {
      try {
        const [rows] = await connection.query<RowDataPacket[]>(query);
        console.log(`=== ${name} ===`);
        console.log(JSON.stringify(rows, null, 2));
      } catch (error) {
        console.log(`=== ${name} ERROR ===`);
        console.log(error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
