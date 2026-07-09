import { Role } from "@prisma/client";
import { hashPassword } from "../lib/auth";
import { prisma } from "../lib/prisma";

async function main() {
  const password = await hashPassword("SuperAdmin@123");

  await prisma.user.upsert({
    where: { email: "superadmin@sms.com" },
    update: {
      firstName: "Super",
      lastName: "Admin",
      password,
      role: Role.SUPER_ADMIN,
      schoolId: null,
      isActive: true,
    },
    create: {
      email: "superadmin@sms.com",
      password,
      firstName: "Super",
      lastName: "Admin",
      role: Role.SUPER_ADMIN,
      schoolId: null,
      isActive: true,
    },
  });

  console.log("Super admin seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Error seeding super admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
