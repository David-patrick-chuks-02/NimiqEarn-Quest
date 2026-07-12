import { prisma } from "../src/index.js";

async function main() {
  console.log("Seeding database...");

  const admin = await prisma.user.upsert({
    where: { telegramId: "0" },
    update: {},
    create: {
      telegramId: "0",
      displayName: "Platform Admin",
      telegramUsername: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const creator = await prisma.user.upsert({
    where: { telegramId: "1" },
    update: {},
    create: {
      telegramId: "1",
      displayName: "Test Creator",
      telegramUsername: "testcreator",
      role: "CREATOR",
      status: "ACTIVE",
    },
  });

  await prisma.quest.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      creatorId: creator.id,
      title: "Welcome to NimiqEarn Quest",
      category: "COMMUNITY_ENGAGEMENT",
      description: "Sample quest for local development. Replace with real campaigns.",
      rewardAmount: 10,
      totalSlots: 100,
      proofType: "TEXT",
      proofInstructions: "Reply with a short intro message.",
      status: "DRAFT",
    },
  });

  console.log("Seed complete:", { adminId: admin.id, creatorId: creator.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
