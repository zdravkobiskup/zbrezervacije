import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Store, Users, Calendar, Shield, Mail, Phone, MapPin } from "lucide-react";
import { format } from "date-fns";
import { hr } from "date-fns/locale";

interface Business {
  id: string;
  name: string;
  category: string;
  email: string;
  phone: string;
  address: string;
  is_active: boolean;
  created_at: string;
  owner_id: string;
}

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role: string;
}

interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
}

const AdminDashboard = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [bookingStats, setBookingStats] = useState<BookingStats>({ total: 0, pending: 0, confirmed: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load all businesses
      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: false });

      if (businessError) throw businessError;
      setBusinesses(businessData || []);

      // Load users with roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Load profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at");

      if (profilesError) throw profilesError;

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]));
      const usersWithRoles = profilesData?.map(p => ({
        ...p,
        role: rolesMap.get(p.id) || "unknown"
      })) || [];

      setUsers(usersWithRoles);

      // Load booking stats
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("status");

      if (bookingsError) throw bookingsError;

      const stats = {
        total: bookingsData?.length || 0,
        pending: bookingsData?.filter(b => b.status === "pending").length || 0,
        confirmed: bookingsData?.filter(b => b.status === "confirmed").length || 0,
        cancelled: bookingsData?.filter(b => b.status === "cancelled").length || 0,
      };
      setBookingStats(stats);

    } catch (error: any) {
      toast.error("Greška prilikom učitavanja podataka");
    } finally {
      setLoading(false);
    }
  };

  const toggleBusinessActive = async (businessId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("businesses")
        .update({ is_active: !currentStatus })
        .eq("id", businessId);

      if (error) throw error;

      setBusinesses(businesses.map(b => 
        b.id === businessId ? { ...b, is_active: !currentStatus } : b
      ));

      toast.success(`Pružatelj usluga je ${!currentStatus ? "aktiviran" : "deaktiviran"}`);
    } catch (error: any) {
      toast.error("Greška prilikom ažuriranja statusa");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Učitavanje...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-8 h-8" />
          Admin Panel
        </h2>
        <p className="text-muted-foreground">Upravljajte korisnicima i pružateljima usluga</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ukupno korisnika</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pružatelji usluga</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{businesses.length}</div>
            <p className="text-xs text-muted-foreground">
              {businesses.filter(b => b.is_active).length} aktivnih
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ukupno rezervacija</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookingStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Na čekanju</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookingStats.pending}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="businesses" className="w-full">
        <TabsList>
          <TabsTrigger value="businesses" className="gap-2">
            <Store className="w-4 h-4" />
            Pružatelji usluga
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Korisnici
          </TabsTrigger>
        </TabsList>

        <TabsContent value="businesses" className="mt-6">
          <div className="space-y-4">
            {businesses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Nema registriranih pružatelja usluga</p>
                </CardContent>
              </Card>
            ) : (
              businesses.map((business) => (
                <Card key={business.id} className="shadow-soft">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {business.name}
                          <Badge variant={business.is_active ? "default" : "secondary"}>
                            {business.is_active ? "Aktivan" : "Neaktivan"}
                          </Badge>
                        </CardTitle>
                        <CardDescription>{business.category}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {business.is_active ? "Aktivan" : "Neaktivan"}
                        </span>
                        <Switch
                          checked={business.is_active}
                          onCheckedChange={() => toggleBusinessActive(business.id, business.is_active)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {business.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span>{business.email}</span>
                      </div>
                    )}
                    {business.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{business.phone}</span>
                      </div>
                    )}
                    {business.address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{business.address}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground pt-2">
                      Registriran: {format(new Date(business.created_at), "PPP", { locale: hr })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <div className="space-y-4">
            {users.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Nema registriranih korisnika</p>
                </CardContent>
              </Card>
            ) : (
              users.map((user) => (
                <Card key={user.id} className="shadow-soft">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {user.full_name || "Nepoznato ime"}
                        </CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                      <Badge variant={
                        user.role === "admin" ? "destructive" : 
                        user.role === "business" ? "default" : "secondary"
                      }>
                        {user.role === "admin" ? "Administrator" :
                         user.role === "business" ? "Pružatelj usluga" : "Klijent"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground">
                      Registriran: {format(new Date(user.created_at), "PPP", { locale: hr })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
