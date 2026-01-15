import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/ingestion/templates - List all mapping templates
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get("sourceType");
    const projectId = searchParams.get("projectId");

    const where: Record<string, unknown> = {};
    if (sourceType) {
      where.sourceType = sourceType;
    }
    if (projectId) {
      where.OR = [{ projectId }, { projectId: null, isPublic: true }];
    }

    const templates = await prisma.mappingTemplate.findMany({
      where,
      orderBy: [{ usageCount: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Vorlagen" },
      { status: 500 }
    );
  }
}

// POST /api/ingestion/templates - Create a new mapping template
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      sourceType,
      projectId,
      isPublic,
      fieldMappings,
      valueMappings,
      categoryMappings,
      dateFormat,
      decimalSeparator,
      thousandsSeparator,
    } = body;

    if (!name || !sourceType || !fieldMappings) {
      return NextResponse.json(
        { error: "Name, Quellentyp und Feldzuordnungen erforderlich" },
        { status: 400 }
      );
    }

    const template = await prisma.mappingTemplate.create({
      data: {
        name,
        description: description || null,
        sourceType,
        projectId: projectId || null,
        isPublic: isPublic || false,
        fieldMappings:
          typeof fieldMappings === "string"
            ? fieldMappings
            : JSON.stringify(fieldMappings),
        valueMappings:
          typeof valueMappings === "string"
            ? valueMappings
            : JSON.stringify(valueMappings || []),
        categoryMappings:
          typeof categoryMappings === "string"
            ? categoryMappings
            : JSON.stringify(categoryMappings || []),
        dateFormat: dateFormat || "DD.MM.YYYY",
        decimalSeparator: decimalSeparator || ",",
        thousandsSeparator: thousandsSeparator || ".",
        createdBy: session.username,
        updatedBy: session.username,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Vorlage" },
      { status: 500 }
    );
  }
}
