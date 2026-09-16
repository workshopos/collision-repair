import { NextResponse } from "next/server";
import { AuthenticationRequiredError, getCurrentUser } from "@/src/lib/auth";
import { createServerSupabaseClient } from "@/src/lib/auth/server";
import { apiError } from "@/src/lib/api-response";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AuthenticationRequiredError();
    }

    const client = await createServerSupabaseClient();
    const { data: memberships, error: membershipError } = await client
      .from("organisation_memberships")
      .select("organisation_id")
      .eq("profile_id", user.id)
      .eq("is_active", true);

    if (membershipError) throw membershipError;

    const organisationIds = [
      ...new Set(
        (memberships ?? [])
          .map((membership) => membership.organisation_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (organisationIds.length === 0) {
      return NextResponse.json({ organisations: [] });
    }

    const [
      { data: organisations, error: organisationError },
      { data: branches, error: branchError },
    ] = await Promise.all([
      client
        .from("organisations")
        .select("id, name")
        .in("id", organisationIds)
        .order("name"),
      client
        .from("branches")
        .select("id, organisation_id, name, code")
        .in("organisation_id", organisationIds)
        .eq("is_active", true)
        .order("name"),
    ]);

    if (organisationError) throw organisationError;
    if (branchError) throw branchError;

    return NextResponse.json({
      organisations: (organisations ?? []).map((organisation) => ({
        id: organisation.id,
        name: organisation.name,
        branches: (branches ?? [])
          .filter((branch) => branch.organisation_id === organisation.id)
          .map((branch) => ({
            id: branch.id,
            name: branch.name,
            code: branch.code,
          })),
      })),
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return apiError("UNAUTHENTICATED", "Authentication required.", 401);
    }

    return apiError("FORBIDDEN", "Unable to load workspace options.", 403);
  }
}
