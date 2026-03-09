import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roles = [
  { slug: "developer", name: "Developer", description: "Software delivery, repos, systems, and technical work.", sortOrder: 1 },
  { slug: "realtor", name: "Realtor", description: "Listings, contacts, showings, and deal flow.", sortOrder: 2 },
  { slug: "adjuster", name: "Adjuster", description: "Claims, inspections, estimates, and field operations.", sortOrder: 3 },
  { slug: "venture", name: "Venture", description: "New bets, experiments, and strategic initiatives.", sortOrder: 4 },
  { slug: "executive", name: "Executive", description: "Cross-role visibility, prioritization, and planning.", sortOrder: 5 },
  { slug: "knowledge", name: "Knowledge", description: "Definitions, SOPs, lessons, and durable notes.", sortOrder: 6 },
];

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL ?? process.env.AUTH_EMAIL ?? "devon.watkins@gmail.com";

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      displayName: "Devon Watkins",
      isOwner: true,
    },
    create: {
      email: ownerEmail,
      displayName: "Devon Watkins",
      isOwner: true,
    },
  });

  for (const role of roles) {
    await prisma.role.upsert({
      where: { slug: role.slug },
      update: role,
      create: role,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
