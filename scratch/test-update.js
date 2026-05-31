import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Attempting database update test for machine 'schaar-elek'...");
    const updated = await prisma.machine.update({
      where: { id: "schaar-elek" },
      data: {
        name: "Elektrische Schaarlift (12m)",
        category: "schaarlift",
        categoryLabel: "Schaarlift",
        height: 12,
        reach: 0,
        weight: 2800,
        pricePerDay: 333,
        powerType: "Elektrisch",
        imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
        description: "Perfect geschikt voor binnenwerkzaamheden, installatiewerk, en schilderwerk in sporthallen of magazijnen. Emissievrij en voorzien van non-marking banden.",
        suitableFor: "Schilder;Installateur;Magazijn;Particulier",
        weeklyDiscountPercent: null,
        monthlyDiscountPercent: null,
        campaignText: null,
        campaignDiscountPercent: null,
        campaignDiscountAmount: null
      }
    });
    console.log("Update succeeded!", updated);
  } catch (error) {
    console.error("Update failed with error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
