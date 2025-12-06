import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BusinessList from "./BusinessList";
import ClientBookingsCalendar from "./ClientBookingsCalendar";
import BookingsArchive from "./BookingsArchive";
import { Calendar, Store, Archive } from "lucide-react";

const ClientDashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dobrodošli!</h2>
        <p className="text-muted-foreground">Pretražite i rezervirajte termine kod vaših omiljenih pružatelja usluga</p>
      </div>

      <Tabs defaultValue="businesses" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="businesses" className="gap-2">
            <Store className="w-4 h-4 hidden sm:inline" />
            <span className="hidden sm:inline">Pružatelji</span>
            <span className="sm:hidden">Pruž.</span>
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2">
            <Calendar className="w-4 h-4 hidden sm:inline" />
            <span className="hidden sm:inline">Rezervacije</span>
            <span className="sm:hidden">Rez.</span>
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2">
            <Archive className="w-4 h-4 hidden sm:inline" />
            <span className="hidden sm:inline">Arhiva</span>
            <span className="sm:hidden">Arh.</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="businesses" className="mt-6">
          <BusinessList />
        </TabsContent>
        
        <TabsContent value="bookings" className="mt-6">
          <ClientBookingsCalendar />
        </TabsContent>

        <TabsContent value="archive" className="mt-6">
          <BookingsArchive isBusinessView={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDashboard;
