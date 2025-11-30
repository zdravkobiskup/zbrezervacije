import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BusinessList from "./BusinessList";
import BookingsList from "./BookingsList";
import { Calendar, Store } from "lucide-react";

const ClientDashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dobrodošli!</h2>
        <p className="text-muted-foreground">Pretražite i rezervirajte termine kod vaših omiljenih pružatelja usluga</p>
      </div>

      <Tabs defaultValue="businesses" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="businesses" className="gap-2">
            <Store className="w-4 h-4" />
            Pružatelji usluga
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2">
            <Calendar className="w-4 h-4" />
            Moje rezervacije
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="businesses" className="mt-6">
          <BusinessList />
        </TabsContent>
        
        <TabsContent value="bookings" className="mt-6">
          <BookingsList isBusinessView={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDashboard;
