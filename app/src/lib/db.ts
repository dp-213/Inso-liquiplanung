import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  initError: Error | undefined;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || "";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log("[db] Creating Prisma client...");
  console.log("[db] DATABASE_URL starts with libsql://:", databaseUrl.startsWith("libsql://"));
  console.log("[db] TURSO_AUTH_TOKEN present:", !!authToken);

  try {
    if (databaseUrl.startsWith("libsql://") && authToken) {
      console.log("[db] Using Turso/libSQL adapter");
      const adapter = new PrismaLibSQL({
        url: databaseUrl,
        authToken: authToken,
      });

      const client = new PrismaClient({
        adapter,
        log: ["error", "warn"],
      });
      console.log("[db] Prisma client created successfully with Turso adapter");
      return client;
    }

    console.log("[db] Using standard SQLite (local development)");
    const client = new PrismaClient({
      log: ["error", "warn"],
    });
    console.log("[db] Prisma client created successfully");
    return client;
  } catch (error) {
    console.error("[db] Error creating Prisma client:", error);
    globalForPrisma.initError = error instanceof Error ? error : new Error(String(error));
    throw error;
  }
}

let prismaInstance: PrismaClient;

try {
  prismaInstance = globalForPrisma.prisma ?? createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }
} catch (error) {
  console.error("[db] Failed to initialize Prisma:", error);
  // Create a dummy client that will throw on any operation
  prismaInstance = new Proxy({} as PrismaClient, {
    get(_, prop) {
      if (prop === "then") return undefined; // Allow Promise checks
      throw globalForPrisma.initError || new Error("Prisma client failed to initialize");
    },
  });
}

export const prisma = prismaInstance;
export default prisma;
