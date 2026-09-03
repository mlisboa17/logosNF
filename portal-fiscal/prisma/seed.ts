import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const hashedPassword = await hashPassword("Admin@1234");

  const user = await db.user.upsert({
    where: { email: "admin@fiscalbox.local" },
    update: {},
    create: {
      email: "admin@fiscalbox.local",
      name: "Admin",
      passwordHash: hashedPassword,
      memberships: {
        create: {
          organization: {
            create: {
              name: "FiscalBox Admin",
            },
          },
          role: "OWNER",
        },
      },
    },
  });

  console.log("✅ Admin user created:", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
