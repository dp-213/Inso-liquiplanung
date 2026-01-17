import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";

const CUSTOMER_SESSION_SECRET =
  process.env.CUSTOMER_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  "customer-liquidity-secret-key-32chars!";
const secretKey = new TextEncoder().encode(CUSTOMER_SESSION_SECRET);

const SESSION_DURATION_HOURS = 8; // Shorter session for external users
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface CustomerSessionData {
  customerId: string;
  email: string;
  name: string;
  company: string | null;
  logoUrl: string | null;
  expiresAt: Date;
}

export async function encryptCustomerSession(
  payload: CustomerSessionData
): Promise<string> {
  return await new SignJWT({
    ...payload,
    expiresAt: payload.expiresAt.toISOString(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
    .sign(secretKey);
}

export async function decryptCustomerSession(
  token: string
): Promise<CustomerSessionData | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return {
      customerId: payload.customerId as string,
      email: payload.email as string,
      name: payload.name as string,
      company: payload.company as string | null,
      logoUrl: (payload.logoUrl as string | null) || null,
      expiresAt: new Date(payload.expiresAt as string),
    };
  } catch {
    return null;
  }
}

export async function getCustomerSession(): Promise<CustomerSessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("customer_session")?.value;

  if (!token) return null;

  const session = await decryptCustomerSession(token);

  if (!session || new Date() > session.expiresAt) {
    return null;
  }

  return session;
}

export async function createCustomerSession(
  customer: {
    id: string;
    email: string;
    name: string;
    company: string | null;
    logoUrl: string | null;
  },
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000
  );

  const sessionData: CustomerSessionData = {
    customerId: customer.id,
    email: customer.email,
    name: customer.name,
    company: customer.company,
    logoUrl: customer.logoUrl,
    expiresAt,
  };

  const token = await encryptCustomerSession(sessionData);

  // Store session in database for tracking
  await prisma.customerSession.create({
    data: {
      customerId: customer.id,
      token,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  // Update last login
  await prisma.customerUser.update({
    where: { id: customer.id },
    data: {
      lastLoginAt: new Date(),
      loginCount: { increment: 1 },
      failedLoginCount: 0, // Reset on successful login
    },
  });

  // Log the login
  await prisma.customerAuditLog.create({
    data: {
      customerId: customer.id,
      action: "LOGIN",
      ipAddress,
      userAgent,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("customer_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteCustomerSession(): Promise<void> {
  const session = await getCustomerSession();
  const cookieStore = await cookies();
  const token = cookieStore.get("customer_session")?.value;

  if (token) {
    // Remove session from database
    await prisma.customerSession.deleteMany({
      where: { token },
    });

    // Log the logout
    if (session) {
      await prisma.customerAuditLog.create({
        data: {
          customerId: session.customerId,
          action: "LOGOUT",
        },
      });
    }
  }

  cookieStore.delete("customer_session");
}

export async function validateCustomerCredentials(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  success: boolean;
  customer?: {
    id: string;
    email: string;
    name: string;
    company: string | null;
    logoUrl: string | null;
  };
  error?: string;
}> {
  const customer = await prisma.customerUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!customer) {
    return { success: false, error: "Ungueltige Anmeldedaten" };
  }

  // Check if account is locked
  if (customer.lockedUntil && new Date() < customer.lockedUntil) {
    const remainingMinutes = Math.ceil(
      (customer.lockedUntil.getTime() - Date.now()) / 60000
    );
    return {
      success: false,
      error: `Konto temporär gesperrt. Bitte versuchen Sie es in ${remainingMinutes} Minuten erneut.`,
    };
  }

  // Check if account is active
  if (!customer.isActive) {
    return {
      success: false,
      error: "Dieses Konto ist deaktiviert. Bitte kontaktieren Sie den Administrator.",
    };
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, customer.passwordHash);

  if (!passwordValid) {
    // Increment failed login count
    const newFailedCount = customer.failedLoginCount + 1;
    const updateData: {
      failedLoginCount: number;
      lockedUntil?: Date;
    } = {
      failedLoginCount: newFailedCount,
    };

    // Lock account if too many failed attempts
    if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(
        Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
      );
    }

    await prisma.customerUser.update({
      where: { id: customer.id },
      data: updateData,
    });

    // Log failed attempt
    await prisma.customerAuditLog.create({
      data: {
        customerId: customer.id,
        action: "LOGIN_FAILED",
        ipAddress,
        userAgent,
      },
    });

    if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
      return {
        success: false,
        error: `Zu viele fehlgeschlagene Versuche. Konto für ${LOCKOUT_DURATION_MINUTES} Minuten gesperrt.`,
      };
    }

    return { success: false, error: "Ungueltige Anmeldedaten" };
  }

  return {
    success: true,
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      company: customer.company,
      logoUrl: customer.logoUrl,
    },
  };
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

export async function requireCustomerAuth(): Promise<CustomerSessionData> {
  const session = await getCustomerSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

// Check if customer has access to a specific case
export async function checkCaseAccess(
  customerId: string,
  caseId: string
): Promise<{
  hasAccess: boolean;
  accessLevel?: string;
  isOwner?: boolean;
}> {
  // First check if customer is the owner
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { ownerId: true },
  });

  if (caseData?.ownerId === customerId) {
    return {
      hasAccess: true,
      accessLevel: "OWNER",
      isOwner: true,
    };
  }

  // Then check explicit access grants
  const access = await prisma.customerCaseAccess.findUnique({
    where: {
      customerId_caseId: {
        customerId,
        caseId,
      },
    },
  });

  if (!access || !access.isActive) {
    return { hasAccess: false };
  }

  // Check expiration
  if (access.expiresAt && new Date() > access.expiresAt) {
    return { hasAccess: false };
  }

  // Update access tracking
  await prisma.customerCaseAccess.update({
    where: { id: access.id },
    data: {
      lastAccessedAt: new Date(),
      accessCount: { increment: 1 },
    },
  });

  return {
    hasAccess: true,
    accessLevel: access.accessLevel,
    isOwner: false,
  };
}

// Get all cases a customer can access (both owned and shared)
export async function getAccessibleCases(customerId: string) {
  // Get owned cases
  const ownedCases = await prisma.case.findMany({
    where: { ownerId: customerId },
    include: {
      owner: { select: { id: true, name: true, company: true } },
      plans: {
        where: { isActive: true },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get shared cases (via CustomerCaseAccess)
  const sharedAccessRecords = await prisma.customerCaseAccess.findMany({
    where: {
      customerId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      case: {
        include: {
          owner: { select: { id: true, name: true, company: true } },
          plans: {
            where: { isActive: true },
            include: {
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: { grantedAt: "desc" },
  });

  // Combine and deduplicate
  const ownedCaseResults = ownedCases.map((caseData) => ({
    caseId: caseData.id,
    accessLevel: "OWNER" as const,
    grantedAt: caseData.createdAt,
    isOwner: true,
    case: caseData,
  }));

  const sharedCaseResults = sharedAccessRecords
    .filter((record) => record.case.ownerId !== customerId) // Exclude owned cases
    .map((record) => ({
      caseId: record.caseId,
      accessLevel: record.accessLevel,
      grantedAt: record.grantedAt,
      isOwner: false,
      case: record.case,
    }));

  return [...ownedCaseResults, ...sharedCaseResults];
}
