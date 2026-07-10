import React from "react";
import { useLocation, Link } from "wouter";
import { getRole, clearTokens, getUser } from '@/lib/auth';
import { useLogout } from "@workspace/api-client-react";
import { 
  Building2, Users, MapPin, FileBox, LayoutDashboard, 
  LogOut, Package, ListChecks, Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Shell({ children }: { children: React.ReactNode }) {
  const role = getRole();
  const user = getUser();
  const [, setLocation] = useLocation();
  const logout = useLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        clearTokens();
        setLocation("/login");
      }
    });
  };

  const superAdminLinks = [
    { href: "/super/offices", label: "Offices", icon: Building2 },
    { href: "/super/users", label: "Users", icon: Users },
  ];

  const adminLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/operators", label: "Operators", icon: Users },
    { href: "/dashboard/beats", label: "Beats", icon: MapPin },
    { href: "/dashboard/map", label: "Live Map", icon: MapPin },
    { href: "/dashboard/articles", label: "Articles", icon: Package },
    { href: "/dashboard/reports", label: "Reports", icon: FileBox },
  ];

  const fieldLinks = [
    { href: "/field", label: "Home", icon: LayoutDashboard },
    { href: "/field/map", label: "Beat Map", icon: MapPin },
    { href: "/field/articles", label: "Deliveries", icon: Package },
    { href: "/field/visits", label: "Visits", icon: ListChecks },
  ];

  let links: { href: string; label: string; icon: any }[] = [];
  if (role === "super_admin") links = superAdminLinks;
  else if (role === "office_admin") links = adminLinks;
  else if (role === "field_operator") links = fieldLinks;

  const NavLinks = () => (
    <>
      <div className="px-4 py-6 border-b">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          Dak Ops
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Logged in as {user?.fullName}</p>
      </div>
      <div className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <div 
              className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted cursor-pointer transition-colors text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              <l.icon className="w-5 h-5 text-muted-foreground" />
              {l.label}
            </div>
          </Link>
        ))}
      </div>
      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start text-destructive" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>
    </>
  );

  // Field operator layout: bottom nav for mobile
  if (role === "field_operator") {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-gray-50 dark:bg-background">
        <header className="bg-primary text-primary-foreground h-14 flex items-center px-4 shadow-md z-10 shrink-0">
          <h1 className="text-lg font-bold">Dak Ops | Field</h1>
          <div className="ml-auto">
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/20">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto pb-16">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center justify-around px-2 z-20 pb-safe">
          {fieldLinks.map((l) => (
            <Link key={l.href} href={l.href}>
              <div className="flex flex-col items-center justify-center w-16 h-full text-muted-foreground hover:text-primary cursor-pointer">
                <l.icon className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-medium">{l.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </div>
    );
  }

  // Admin/Super Admin layout: sidebar on desktop, header + drawer on mobile
  return (
    <div className="flex min-h-[100dvh] bg-muted/40">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-card border-r shrink-0 sticky top-0 h-[100dvh]">
        <NavLinks />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden bg-card border-b h-14 flex items-center px-4 shrink-0 sticky top-0 z-10">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2 mr-2">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <NavLinks />
            </SheetContent>
          </Sheet>
          <h1 className="font-bold text-primary">Dak Ops</h1>
        </header>
        
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
