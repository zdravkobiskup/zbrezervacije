import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HeroButton } from "@/components/ui/hero-button";
import { Calendar, Users, Clock, Star } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate("/dashboard");
    } else {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="relative min-h-[80vh] flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        
        <div className="relative z-10 container mx-auto px-4 text-center space-y-8">
          <img
            src={logo}
            alt="ZB rezervacije"
            className="w-64 md:w-80 mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 drop-shadow-lg"
          />
          
          <p className="text-xl md:text-2xl text-foreground/90 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-150">
            Jednostavno rezervirajte termine kod vaših omiljenih pružatelja usluga
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
            <HeroButton variant="primary" onClick={() => navigate("/auth")}>
              Prijavi se
            </HeroButton>
            <HeroButton variant="secondary" onClick={() => navigate("/auth")}>
              Registriraj se
            </HeroButton>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Zašto odabrati BookEasy?
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center space-y-4 p-6 rounded-2xl bg-card shadow-soft hover:shadow-medium transition-all duration-300">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Brza rezervacija</h3>
              <p className="text-muted-foreground">
                Rezervirajte termine u samo nekoliko klikova
              </p>
            </div>

            <div className="text-center space-y-4 p-6 rounded-2xl bg-card shadow-soft hover:shadow-medium transition-all duration-300">
              <div className="w-16 h-16 mx-auto rounded-full bg-secondary/10 flex items-center justify-center">
                <Users className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold">Za pružatelje usluga</h3>
              <p className="text-muted-foreground">
                Upravljajte svojim terminima i klijentima
              </p>
            </div>

            <div className="text-center space-y-4 p-6 rounded-2xl bg-card shadow-soft hover:shadow-medium transition-all duration-300">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">24/7 dostupno</h3>
              <p className="text-muted-foreground">
                Rezervirajte termine bilo kada, bilo gdje
              </p>
            </div>

            <div className="text-center space-y-4 p-6 rounded-2xl bg-card shadow-soft hover:shadow-medium transition-all duration-300">
              <div className="w-16 h-16 mx-auto rounded-full bg-secondary/10 flex items-center justify-center">
                <Star className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold">Jednostavno</h3>
              <p className="text-muted-foreground">
                Intuitivno sučelje koje svatko može koristiti
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-hero">
        <div className="container mx-auto px-4 text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Spremni za početak?
          </h2>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Pridružite se tisućama zadovoljnih korisnika koji koriste BookEasy
          </p>
          <HeroButton variant="secondary" onClick={() => navigate("/auth")}>
            Registrirajte se besplatno
          </HeroButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-card">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 BookEasy. Sva prava pridržana.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
