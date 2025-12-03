import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Phone, Mail, Calendar, Heart, Search } from "lucide-react";
import BookingDialog from "./BookingDialog";

interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  phone: string;
  email: string;
  image_url: string;
  working_hours?: any;
}

const BusinessList = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Search/filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadBusinesses();
    loadUserAndFavorites();
  }, []);

  const loadUserAndFavorites = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: favData } = await supabase
        .from("favorites")
        .select("business_id")
        .eq("user_id", user.id);
      
      if (favData) {
        setFavorites(favData.map(f => f.business_id));
      }
    }
  };

  const loadBusinesses = async () => {
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBusinesses(data || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set((data || []).map(b => b.category))];
      setCategories(uniqueCategories);
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja pružatelja usluga");
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (businessId: string) => {
    if (!userId) {
      toast.error("Morate biti prijavljeni za dodavanje favorita");
      return;
    }

    const isFavorite = favorites.includes(businessId);
    
    if (isFavorite) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("business_id", businessId);
      
      if (error) {
        toast.error("Greška prilikom uklanjanja iz favorita");
        return;
      }
      setFavorites(favorites.filter(id => id !== businessId));
      toast.success("Uklonjeno iz favorita");
    } else {
      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: userId, business_id: businessId });
      
      if (error) {
        toast.error("Greška prilikom dodavanja u favorite");
        return;
      }
      setFavorites([...favorites, businessId]);
      toast.success("Dodano u favorite");
    }
  };

  const openBookingDialog = (business: Business) => {
    setSelectedBusiness(business);
    setBookingDialogOpen(true);
  };

  // Filter businesses
  const filteredBusinesses = businesses.filter(business => {
    const matchesSearch = business.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         business.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || business.category === selectedCategory;
    const matchesLocation = !locationFilter || 
                           business.address?.toLowerCase().includes(locationFilter.toLowerCase());
    const matchesFavorites = !showFavoritesOnly || favorites.includes(business.id);
    
    return matchesSearch && matchesCategory && matchesLocation && matchesFavorites;
  });

  if (loading) {
    return <div className="text-center py-8">Učitavanje...</div>;
  }

  return (
    <>
      {/* Search and Filter Section */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži pružatelje usluga..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Sve djelatnosti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sve djelatnosti</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filtriraj po lokaciji..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="pl-10"
            />
          </div>
          {userId && (
            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className="gap-2"
            >
              <Heart className={`w-4 h-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
              Samo favoriti
            </Button>
          )}
        </div>
      </div>

      {filteredBusinesses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {businesses.length === 0 
                ? "Trenutno nema dostupnih pružatelja usluga" 
                : "Nema rezultata za zadane filtere"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBusinesses.map((business) => (
            <Card key={business.id} className="shadow-soft hover:shadow-medium transition-shadow overflow-hidden">
              {business.image_url && (
                <div className="h-48 overflow-hidden bg-gradient-card relative">
                  <img
                    src={business.image_url}
                    alt={business.name}
                    className="w-full h-full object-cover"
                  />
                  {userId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                      onClick={() => toggleFavorite(business.id)}
                    >
                      <Heart 
                        className={`w-5 h-5 ${favorites.includes(business.id) ? "fill-red-500 text-red-500" : ""}`} 
                      />
                    </Button>
                  )}
                </div>
              )}
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary">{business.category}</Badge>
                  {!business.image_url && userId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFavorite(business.id)}
                    >
                      <Heart 
                        className={`w-5 h-5 ${favorites.includes(business.id) ? "fill-red-500 text-red-500" : ""}`} 
                      />
                    </Button>
                  )}
                </div>
                <CardTitle className="text-xl">{business.name}</CardTitle>
                {business.description && (
                  <CardDescription className="line-clamp-2">
                    {business.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {business.address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{business.address}</span>
                  </div>
                )}
                {business.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{business.phone}</span>
                  </div>
                )}
                {business.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{business.email}</span>
                  </div>
                )}
                <Button
                  className="w-full mt-4 gap-2"
                  onClick={() => openBookingDialog(business)}
                >
                  <Calendar className="w-4 h-4" />
                  Rezerviraj termin
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedBusiness && (
        <BookingDialog
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
          business={selectedBusiness}
        />
      )}
    </>
  );
};

export default BusinessList;
