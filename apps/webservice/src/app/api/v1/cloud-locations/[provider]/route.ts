import { NextResponse } from "next/server";

import { cloudRegionsGeo } from "@ctrlplane/validators/resources";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  // Check if provider exists
  if (cloudRegionsGeo[provider] == null)
    return NextResponse.json(
      { error: `Cloud provider '${provider}' not found` },
      { status: 404 },
    );

  // Return all regions for the specified provider
  return NextResponse.json(cloudRegionsGeo[provider]);
}
