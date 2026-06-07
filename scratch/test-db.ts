import { prisma } from "../prisma/client.js";

async function main() {
  try {
    const machinesCount = await prisma.machine.count();
    const ordersCount = await prisma.order.count();
    const adminsCount = await prisma.admin.count();
    const admins = await prisma.admin.findMany();
    
    console.log("Database Stats:");
    console.log("- Machines count:", machinesCount);
    console.log("- Orders count:", ordersCount);
    console.log("- Admins count:", adminsCount);
    console.log("- Admin details:", admins);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
