import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from "date-fns";
import { hr } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Calendar, CheckCircle, XCircle, Clock, Users, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface BookingsReportProps {
  businessId: string;
}

interface BookingStats {
  completed: number;
  no_show: number;
  rescheduled: number;
  cancelled: number;
  pending: number;
  confirmed: number;
  total: number;
}

interface ClientBooking {
  id: string;
  client_name: string;
  client_email: string;
  service_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
}

const COLORS = {
  completed: "#10B981",
  no_show: "#6B7280",
  rescheduled: "#8B5CF6",
  cancelled: "#EF4444",
  pending: "#F59E0B",
  confirmed: "#3B82F6",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Završeno",
  no_show: "Nije došao/la",
  rescheduled: "Promijenjen termin",
  cancelled: "Otkazano",
  pending: "Na čekanju",
  confirmed: "Potvrđeno",
};

const BookingsReport = ({ businessId }: BookingsReportProps) => {
  const [stats, setStats] = useState<BookingStats>({
    completed: 0,
    no_show: 0,
    rescheduled: 0,
    cancelled: 0,
    pending: 0,
    confirmed: 0,
    total: 0,
  });
  const [clientBookings, setClientBookings] = useState<ClientBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    loadReport();
  }, [businessId, period, selectedMonth]);

  const getDateRange = () => {
    const now = new Date();
    
    if (period === "today") {
      return {
        start: format(startOfDay(now), "yyyy-MM-dd"),
        end: format(endOfDay(now), "yyyy-MM-dd"),
      };
    } else if (period === "month") {
      const [year, month] = selectedMonth.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return {
        start: format(startOfMonth(date), "yyyy-MM-dd"),
        end: format(endOfMonth(date), "yyyy-MM-dd"),
      };
    }
    
    return {
      start: format(startOfMonth(now), "yyyy-MM-dd"),
      end: format(endOfMonth(now), "yyyy-MM-dd"),
    };
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          booking_date,
          booking_time,
          status,
          client_id,
          services (name)
        `)
        .eq("business_id", businessId)
        .gte("booking_date", start)
        .lte("booking_date", end)
        .order("booking_date", { ascending: false });

      if (error) throw error;

      // Get client profiles
      if (data && data.length > 0) {
        const clientIds = [...new Set(data.map(b => b.client_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", clientIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

        // Calculate stats
        const newStats: BookingStats = {
          completed: 0,
          no_show: 0,
          rescheduled: 0,
          cancelled: 0,
          pending: 0,
          confirmed: 0,
          total: data.length,
        };

        const bookingsWithClients: ClientBooking[] = [];

        data.forEach((booking) => {
          const status = booking.status as keyof BookingStats;
          if (status in newStats) {
            newStats[status]++;
          }

          const profile = profilesMap.get(booking.client_id);
          bookingsWithClients.push({
            id: booking.id,
            client_name: profile?.full_name || "Nepoznato",
            client_email: profile?.email || "",
            service_name: (booking.services as any)?.name || "",
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
            status: booking.status,
          });
        });

        setStats(newStats);
        setClientBookings(bookingsWithClients);
      } else {
        setStats({
          completed: 0,
          no_show: 0,
          rescheduled: 0,
          cancelled: 0,
          pending: 0,
          confirmed: 0,
          total: 0,
        });
        setClientBookings([]);
      }
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja izvještaja");
    } finally {
      setLoading(false);
    }
  };

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = subMonths(now, i);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "LLLL yyyy", { locale: hr }),
      });
    }
    return options;
  };

  const pieChartData = [
    { name: "Završeno", value: stats.completed, color: COLORS.completed },
    { name: "Nije došao/la", value: stats.no_show, color: COLORS.no_show },
    { name: "Promijenjen termin", value: stats.rescheduled, color: COLORS.rescheduled },
    { name: "Otkazano", value: stats.cancelled, color: COLORS.cancelled },
  ].filter(item => item.value > 0);

  const barChartData = [
    { name: "Završeno", value: stats.completed, fill: COLORS.completed },
    { name: "Nije došao/la", value: stats.no_show, fill: COLORS.no_show },
    { name: "Promijenjeno", value: stats.rescheduled, fill: COLORS.rescheduled },
    { name: "Otkazano", value: stats.cancelled, fill: COLORS.cancelled },
  ];

  const completionRate = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  if (loading) {
    return <div className="text-center py-8">Učitavanje izvještaja...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Danas</SelectItem>
            <SelectItem value="month">Mjesečno</SelectItem>
          </SelectContent>
        </Select>

        {period === "month" && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ukupno rezervacija</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Završeno</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {completionRate}% stopa završetka
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nije došao/la</CardTitle>
            <XCircle className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.no_show}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Promijenjeno</CardTitle>
            <Clock className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.rescheduled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {stats.total > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pregled po statusu</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usporedba statusa</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Client Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Popis klijenata i rezervacija
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clientBookings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nema rezervacija u odabranom razdoblju
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Klijent</TableHead>
                    <TableHead>Usluga</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Vrijeme</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{booking.client_name}</p>
                          <p className="text-sm text-muted-foreground">{booking.client_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{booking.service_name}</TableCell>
                      <TableCell>
                        {format(new Date(booking.booking_date), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell>{booking.booking_time}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            booking.status === "completed" ? "border-green-500 text-green-700" :
                            booking.status === "no_show" ? "border-gray-500 text-gray-700" :
                            booking.status === "rescheduled" ? "border-purple-500 text-purple-700" :
                            booking.status === "cancelled" ? "border-red-500 text-red-700" :
                            booking.status === "confirmed" ? "border-blue-500 text-blue-700" :
                            "border-yellow-500 text-yellow-700"
                          }
                        >
                          {STATUS_LABELS[booking.status] || booking.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingsReport;
