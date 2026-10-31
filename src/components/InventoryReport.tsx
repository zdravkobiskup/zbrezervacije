import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingDown, Package } from "lucide-react";

interface InventoryReportProps {
  businessId: string;
}

interface ConsumptionData {
  material_name: string;
  total_consumed: number;
  unit: string;
  total_cost: number;
}

const InventoryReport = ({ businessId }: InventoryReportProps) => {
  const [data, setData] = useState<ConsumptionData[]>([]);
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [businessId, period]);

  const loadReport = async () => {
    setLoading(true);
    try {
      // Get materials for this business
      const { data: materials, error: matError } = await supabase
        .from("materials")
        .select("id, name, unit, price_per_unit")
        .eq("business_id", businessId);
      if (matError) throw matError;

      if (!materials || materials.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const materialIds = materials.map(m => m.id);
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - parseInt(period));

      // Get consumption transactions (negative quantity_change)
      const { data: transactions, error: txError } = await supabase
        .from("material_transactions")
        .select("material_id, quantity_change")
        .in("material_id", materialIds)
        .in("type", ["auto_deduct", "manual_deduct"])
        .gte("created_at", sinceDate.toISOString());
      if (txError) throw txError;

      // Aggregate
      const consumption: Record<string, number> = {};
      (transactions || []).forEach(tx => {
        consumption[tx.material_id] = (consumption[tx.material_id] || 0) - tx.quantity_change;
      });

      const reportData: ConsumptionData[] = materials
        .map(m => ({
          material_name: m.name,
          total_consumed: consumption[m.id] || 0,
          unit: m.unit,
          total_cost: (consumption[m.id] || 0) * m.price_per_unit,
        }))
        .filter(d => d.total_consumed > 0)
        .sort((a, b) => b.total_consumed - a.total_consumed);

      setData(reportData);
    } catch (error) {
      console.error("Error loading report:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalCost = data.reduce((sum, d) => sum + d.total_cost, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                Izvještaj potrošnje
              </CardTitle>
              <CardDescription>Pregled najkorištenijih materijala</CardDescription>
            </div>
            <div className="w-40">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Zadnjih 7 dana</SelectItem>
                  <SelectItem value="30">Zadnjih 30 dana</SelectItem>
                  <SelectItem value="90">Zadnjih 90 dana</SelectItem>
                  <SelectItem value="365">Zadnjih 365 dana</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Učitavanje...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              Nema podataka o potrošnji za odabrano razdoblje.
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">Ukupni trošak materijala: </span>
                <span className="font-bold text-lg">{totalCost.toFixed(2)} €</span>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="material_name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => [
                        `${value} ${props.payload.unit} (${props.payload.total_cost.toFixed(2)} €)`,
                        "Potrošnja"
                      ]}
                    />
                    <Bar dataKey="total_consumed" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 space-y-2">
                {data.map((d, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <span className="font-medium">{i + 1}. {d.material_name}</span>
                    </div>
                    <div className="text-right text-sm">
                      <span className="font-semibold">{d.total_consumed} {d.unit}</span>
                      <span className="text-muted-foreground ml-2">({d.total_cost.toFixed(2)} €)</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryReport;
