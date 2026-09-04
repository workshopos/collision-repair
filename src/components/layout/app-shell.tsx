import Link from "next/link";
import {
  ClipboardList,
  LayoutDashboard,
  Settings2,
  Wrench,
} from "lucide-react";
import { UserMenu } from "@/src/components/layout/user-menu";
import type { TenantScope } from "@/src/lib/tenant";

type NavigationItem = {
  label: string;
  href: string;
  permission?: string;
  icon: typeof LayoutDashboard;
};

const navigationItems: NavigationItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  {
    label: "Repair Orders",
    href: "/repair-orders",
    permission: "repair_order.view",
    icon: ClipboardList,
  },
  { label: "Workshop settings", href: "/settings", icon: Settings2 },
];

export function AppShell({
  children,
  user,
  tenantContext,
  permissions,
}: Readonly<{
  children: React.ReactNode;
  user: { email: string; id: string };
  tenantContext: TenantScope;
  permissions: Set<string>;
}>) {
  const visibleNavigation = navigationItems.filter(
    (item) => !item.permission || permissions.has(item.permission),
  );

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#202c2b]">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-[#d8d0c4] bg-[#202c2b] text-[#f4f1ea] lg:flex">
        <div className="border-b border-[#52605a] px-7 py-7">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center bg-[#e1a84b] text-[#202c2b]">
              <Wrench className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-serif text-xl leading-none">WorkShopOS</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#aebbb2]">
                Collision operations
              </p>
            </div>
          </div>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 px-4 py-7">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b9a91]">
            Workspace
          </p>
          <div className="mt-3 space-y-1">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 px-3 text-sm text-[#d9e0d9] transition-colors hover:bg-[#33433c] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e1a84b]"
                >
                  <Icon className="size-4 text-[#e1a84b]" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-[#52605a] px-7 py-5">
          <p className="text-xs text-[#aebbb2]">Active branch</p>
          <p className="mt-1 truncate text-sm font-medium text-white">
            {tenantContext.branchId}
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="flex min-h-20 items-center justify-between border-b border-[#d8d0c4] bg-[#fffdf8] px-5 sm:px-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c0522e]">
              Current workspace
            </p>
            <p className="mt-1 text-sm font-semibold text-[#202c2b]">
              Organisation {tenantContext.organisationId.slice(0, 8)}
              <span className="px-2 text-[#aeb0a8]">/</span>
              Branch {tenantContext.branchId?.slice(0, 8)}
            </p>
          </div>
          <UserMenu email={user.email} />
        </header>

        <main className="min-h-[calc(100vh-5rem)] px-5 py-8 sm:px-8 lg:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}