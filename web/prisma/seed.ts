import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "네오랩 데모 고객사",
    },
  });

  await prisma.user.upsert({
    where: { email: "demo-admin@neolab.local" },
    update: {},
    create: {
      orgId: org.id,
      role: "admin",
      email: "demo-admin@neolab.local",
      name: "데모 관리자",
    },
  });

  console.log("Seeded organization:", org.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
