import { NextResponse } from "next/server";
import { deleteCustomerSession } from "@/lib/customer-auth";

export async function POST() {
  try {
    await deleteCustomerSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer logout error:", error);
    return NextResponse.json(
      { error: "Abmeldung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
