/**
 * Case Configuration API Route
 *
 * Handles GET and PUT requests for case dashboard configuration.
 *
 * GET /api/cases/[id]/config - Retrieve case configuration
 * PUT /api/cases/[id]/config - Update case configuration
 *
 * @module api/cases/[id]/config
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  loadDashboardConfig,
  saveConfigToDatabase,
  createDefaultConfig,
  validateDashboardConfig,
  hasCaseCodeConfig,
  getCaseCodeConfig,
} from "@/lib/case-dashboard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/config
 *
 * Retrieves the resolved dashboard configuration for a case.
 * Returns merged configuration from defaults, database, and code.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: caseId } = await params;

    // Verify case exists
    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, debtorName: true, caseNumber: true },
    });

    if (!caseExists) {
      return NextResponse.json(
        { error: "Case not found", code: "CASE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Load resolved configuration
    const loaderResult = await loadDashboardConfig(caseId, "api");

    // Get code config metadata if exists
    const codeConfig = getCaseCodeConfig(caseId);

    return NextResponse.json({
      success: true,
      caseId,
      caseName: caseExists.debtorName,
      caseNumber: caseExists.caseNumber,
      config: loaderResult.config,
      metadata: {
        configSource: loaderResult.configSource,
        usesCustomCode: loaderResult.usesCustomCode,
        customComponentPath: loaderResult.customComponentPath,
        warnings: loaderResult.warnings,
        codeConfig: codeConfig
          ? {
              displayName: codeConfig.displayName,
              version: codeConfig.version,
              description: codeConfig.description,
              replaceUIConfig: codeConfig.replaceUIConfig,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching case config:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch configuration",
        code: "FETCH_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/cases/[id]/config
 *
 * Updates the dashboard configuration for a case.
 * Validates the configuration before saving.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: caseId } = await params;

    // Verify case exists
    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseExists) {
      return NextResponse.json(
        { error: "Case not found", code: "CASE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    // Extract config and userId from body
    const { config, userId = "admin" } = body as {
      config: unknown;
      userId?: string;
    };

    if (!config) {
      return NextResponse.json(
        { error: "Missing config in request body", code: "MISSING_CONFIG" },
        { status: 400 }
      );
    }

    // Validate config
    const validation = validateDashboardConfig(config);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Invalid configuration",
          code: "VALIDATION_ERROR",
          details: validation.errors.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // Save to database
    const saved = await saveConfigToDatabase(caseId, validation.data, userId);

    if (!saved) {
      return NextResponse.json(
        { error: "Failed to save configuration", code: "SAVE_ERROR" },
        { status: 500 }
      );
    }

    // Reload to get merged result
    const loaderResult = await loadDashboardConfig(caseId, userId);

    return NextResponse.json({
      success: true,
      caseId,
      config: loaderResult.config,
      metadata: {
        configSource: loaderResult.configSource,
        usesCustomCode: loaderResult.usesCustomCode,
        warnings: loaderResult.warnings,
        savedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error saving case config:", error);
    return NextResponse.json(
      {
        error: "Failed to save configuration",
        code: "SAVE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cases/[id]/config
 *
 * Resets the configuration to defaults by deleting from database.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: caseId } = await params;

    // Verify case exists
    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseExists) {
      return NextResponse.json(
        { error: "Case not found", code: "CASE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Delete from database
    try {
      await prisma.caseConfiguration.delete({
        where: {
          caseId_configType: {
            caseId,
            configType: "DASHBOARD_CONFIG",
          },
        },
      });
    } catch (error) {
      // If record doesn't exist, that's fine
      if ((error as { code?: string }).code !== "P2025") {
        throw error;
      }
    }

    // Return default config
    const defaultConfig = createDefaultConfig("admin");

    return NextResponse.json({
      success: true,
      caseId,
      config: defaultConfig,
      metadata: {
        configSource: "default",
        usesCustomCode: hasCaseCodeConfig(caseId),
        resetAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error resetting case config:", error);
    return NextResponse.json(
      {
        error: "Failed to reset configuration",
        code: "RESET_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
