import { z } from "zod";

export const tenantScopeSchema = z.object({
  organisationId: z.string().uuid("Organisation ID must be a valid UUID."),
  branchId: z
    .string()
    .uuid("Branch ID must be a valid UUID.")
    .nullable()
    .optional(),
});

export type TenantScope = z.infer<typeof tenantScopeSchema>;

export function isValidTenantScope(value: unknown): value is TenantScope {
  return tenantScopeSchema.safeParse(value).success;
}

export async function resolveCurrentTenantContext(
  value?: Partial<TenantScope>,
): Promise<TenantScope> {
  const source = value ?? {};
  const parsed = tenantScopeSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `Invalid tenant scope: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`,
    );
  }

  return parsed.data;
}

export async function requireTenantMembership(
  scope: TenantScope,
  membershipCheck: (scope: TenantScope) => boolean | Promise<boolean>,
): Promise<TenantScope> {
  const isAllowed = await membershipCheck(scope);

  if (!isAllowed) {
    throw new Error(
      "The authenticated user is not a member of the requested organisation or branch.",
    );
  }

  return scope;
}
