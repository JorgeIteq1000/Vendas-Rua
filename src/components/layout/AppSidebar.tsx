import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MapPin,
  LayoutGrid,
  ShoppingCart,
  UserPlus,
  Users,
  BarChart3,
  LogOut,
  Building2,
  FileText,
  Map, // 👈 IMPORTANTE: O ícone Map voltou!
} from "lucide-react";

const menuItems = {
  seller: [
    { title: "PDV", icon: LayoutGrid, href: "/" },
    { title: "Cadastrar PDV", icon: MapPin, href: "/cadastrar-pdv" },
    { title: "Vendas", icon: ShoppingCart, href: "/vendas" },
    { title: "Cadastrar Cliente", icon: UserPlus, href: "/cadastrar-cliente" },
  ],
  manager: [
    { title: "PDV", icon: LayoutGrid, href: "/" },
    { title: "Distribuir Rotas", icon: Map, href: "/distribuir" }, // 👈 VOLTOU AQUI
    { title: "Cadastrar PDV", icon: MapPin, href: "/cadastrar-pdv" },
    { title: "Vendas", icon: ShoppingCart, href: "/vendas" },
    { title: "Cadastrar", icon: UserPlus, href: "/cadastrar-cliente" }, // Ajustei para apontar para o cadastro de cliente se ele for vender
    { title: "Equipe", icon: Users, href: "/equipe" },
    { title: "Ver Equipe (GPS)", icon: Map, href: "/ver-vendedores" }, // 👈 NOVO
  ],
  admin: [
    { title: "PDV", icon: LayoutGrid, href: "/" },
    { title: "Distribuir Rotas", icon: Map, href: "/distribuir" }, // 👈 VOLTOU AQUI
    { title: "Cadastrar PDV", icon: MapPin, href: "/cadastrar-pdv" },
    { title: "Cadastrar", icon: Building2, href: "/cadastrar" }, // Mantive seu link de cadastro genérico se houver
    { title: "Gerentes", icon: Users, href: "/gerentes" },
    { title: "Relatórios de Vendas", icon: FileText, href: "/vendas" },
    { title: "Mapa de Calor", icon: Map, href: "/mapa" }, // NOVO
    { title: "Ver Equipe (GPS)", icon: Map, href: "/ver-vendedores" }, // 👈 NOVO
  ],
};

export function AppSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const role = profile?.role || "seller";
  const items = menuItems[role] || menuItems.seller;

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <MapPin className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg font-display">PDV Tracker</h1>
            <p className="text-xs text-muted-foreground capitalize">
              {role === "manager"
                ? "Gerente"
                : role === "seller"
                ? "Vendedor"
                : "Administrador"}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider px-4">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.href}
                    className="h-12"
                  >
                    <Link
                      to={item.href}
                      className="flex items-center gap-3 px-4"
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {profile?.full_name || "Usuário"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {profile?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-10 text-muted-foreground hover:text-foreground"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
