import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth/session";
import { checkTenantQuota } from "@/lib/saas/tenant";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await authSession.requireSession();
    const organizationId = session.user.memberships[0]?.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organização não encontrada." }, { status: 400 });
    }

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        maxCompanies: true,
        maxMonthlyDocuments: true,
        billingEmail: true,
      },
    });

    const companyQuota = await checkTenantQuota(organizationId, "companies");
    const documentQuota = await checkTenantQuota(organizationId, "documents");

    return NextResponse.json({
      organization: org,
      quotas: {
        companies: {
          current: companyQuota.currentCount,
          limit: companyQuota.limit,
          allowed: companyQuota.allowed,
        },
        monthlyDocuments: {
          current: documentQuota.currentCount,
          limit: documentQuota.limit,
          allowed: documentQuota.allowed,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao consultar utilização do tenant." }, { status: 500 });
  }
}
