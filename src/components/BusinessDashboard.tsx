import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Store, Calendar, Settings, Users, BarChart3, Archive } from "lucide-react";
import { toast } from "sonner";
import BusinessSetup from "./BusinessSetup";
import ServiceManagement from "./ServiceManagement";
import BookingsCalendar from "./BookingsCalendar";
import EmployeeManagement from "./EmployeeManagement";
import EmployeeGroupManagement from "./EmployeeGroupManagement";
import BookingsReport from "./BookingsReport";
import BookingsArchive from "./BookingsArchive";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmployeeGroup {
  id: string;
  name: string;
  working_hours: Record<string, string> | null;
}

const BusinessDashboard = () => {
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [groups, setGroups] = useState<EmployeeGroup[]>([]);

  useEffect(() => {
    loadBusiness();
  }, []);

  useEffect(() => {
    if (business?.id) {
      loadGroups();
    }
  }, [business?.id]);

  const loadBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      setBusiness(data);
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja podataka");
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_groups")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at");

      if (error) throw error;
      setGroups((data || []).map(g => ({
        ...g,
        working_hours: g.working_hours as Record<string, string> | null
      })));
    } catch (error: any) {
      console.error("Error loading groups:", error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Učitavanje...</div>;
  }

  if (!business && !showSetup) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-medium">
          <CardHeader className="text-center space-y-2">
            <Store className="w-16 h-16 mx-auto text-primary" />
            <CardTitle className="text-2xl">Dobrodošli na BookEasy!</CardTitle>
            <CardDescription>
              Započnite s postavljanjem vaše tvrtke i usluga koje nudite
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => setShowSetup(true)} size="lg" className="gap-2">
              <Plus className="w-5 h-5" />
              Kreiraj tvrtku
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showSetup || !business) {
    return <BusinessSetup onComplete={() => {
      setShowSetup(false);
      loadBusiness();
    }} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">{business.name}</h2>
          <p className="text-muted-foreground">{business.category}</p>
        </div>
        <Button variant="outline" onClick={() => setShowSetup(true)} className="gap-2">
          <Settings className="w-4 h-4" />
          Uredi tvrtku
        </Button>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="w-4 h-4 hidden sm:inline" />
            <span className="hidden sm:inline">Kalendar</span>
            <span className="sm:hidden">Kal.</span>
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2">
            <Archive className="w-4 h-4 hidden sm:inline" />
            <span className="hidden sm:inline">Arhiva</span>
            <span className="sm:hidden">Arh.</span>
          </TabsTrigger>
          <TabsTrigger value="services">
            <span className="hidden sm:inline">Usluge</span>
            <span className="sm:hidden">Usl.</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="w-4 h-4 hidden sm:inline" />
            <span className="hidden sm:inline">Zaposlenici</span>
            <span className="sm:hidden">Zap.</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <BarChart3 className="w-4 h-4 hidden sm:inline" />
            <span className="hidden sm:inline">Izvještaji</span>
            <span className="sm:hidden">Izv.</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendar" className="mt-6">
          <BookingsCalendar businessId={business.id} businessName={business.name} workingHours={business.working_hours} />
        </TabsContent>
        
        <TabsContent value="archive" className="mt-6">
          <BookingsArchive businessId={business.id} isBusinessView={true} />
        </TabsContent>
        
        <TabsContent value="services" className="mt-6">
          <ServiceManagement businessId={business.id} />
        </TabsContent>
        
        <TabsContent value="employees" className="mt-6">
          <div className="space-y-8">
            <EmployeeGroupManagement 
              businessId={business.id} 
              onGroupsChange={loadGroups}
            />
            <EmployeeManagement 
              businessId={business.id} 
              groups={groups}
            />
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <BookingsReport businessId={business.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessDashboard;
