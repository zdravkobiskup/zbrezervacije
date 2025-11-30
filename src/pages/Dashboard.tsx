import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BusinessDashboard from "@/components/BusinessDashboard";
import ClientDashboard from "@/components/ClientDashboard";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"business" | "client" | null>(null);

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
        .single();

      if (roleError) throw roleError;

      setUserRole(roleData.role as "business" | "client");
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

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">BookEasy</h1>
          <Button variant="outline" onClick={handleSignOut}>
            Odjavi se
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {userRole === "business" ? <BusinessDashboard /> : <ClientDashboard />}
      </main>
    </div>
  );
};

export default Dashboard;
