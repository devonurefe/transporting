import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.customer.count();
  const customers = await prisma.customer.findMany();
  console.log(`Registered Customers Count: ${count}`);
  console.log(JSON.stringify(customers, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
