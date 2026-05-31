import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.siteConfig.findMany();
  console.log("=== SiteConfig in DB ===");
  console.log(JSON.stringify(configs, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
