import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BusinessDashboard from "@/components/BusinessDashboard";
import ClientDashboard from "@/components/ClientDashboard";
import AdminDashboard from "@/components/AdminDashboard";
import NotificationBell from "@/components/NotificationBell";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"business" | "client" | "admin" | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      if (roleData) {
        setUserRole(roleData.role as "business" | "client" | "admin");
      } else {
        toast.error("Korisnička uloga nije pronađena");
        navigate("/auth");
      }
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja profila");
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
    toast.success("Uspješno ste se odjavili");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Učitavanje...</p>
      </div>
    );
  }

  const renderDashboard = () => {
    switch (userRole) {
      case "admin":
        return <AdminDashboard />;
      case "business":
        return <BusinessDashboard />;
      case "client":
        return <ClientDashboard />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary">ZB rezervacije</h1>
            {userRole === "admin" && (
              <span className="px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded">
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="outline" onClick={handleSignOut}>
              Odjavi se
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {renderDashboard()}
      </main>
    </div>
  );
};

export default Dashboard;
