import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Store, Calendar, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import BusinessSetup from "./BusinessSetup";
import ServiceManagement from "./ServiceManagement";
import BookingsList from "./BookingsList";
import BookingsCalendar from "./BookingsCalendar";
import EmployeeManagement from "./EmployeeManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BusinessDashboard = () => {
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    loadBusiness();
  }, []);

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="w-4 h-4 hidden sm:inline" />
            Kalendar
          </TabsTrigger>
          <TabsTrigger value="bookings">Rezervacije</TabsTrigger>
          <TabsTrigger value="services">Usluge</TabsTrigger>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="w-4 h-4 hidden sm:inline" />
            Zaposlenici
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendar" className="mt-6">
          <BookingsCalendar businessId={business.id} />
        </TabsContent>
        
        <TabsContent value="bookings" className="mt-6">
          <BookingsList businessId={business.id} isBusinessView={true} />
        </TabsContent>
        
        <TabsContent value="services" className="mt-6">
          <ServiceManagement businessId={business.id} />
        </TabsContent>
        
        <TabsContent value="employees" className="mt-6">
          <EmployeeManagement businessId={business.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessDashboard;
