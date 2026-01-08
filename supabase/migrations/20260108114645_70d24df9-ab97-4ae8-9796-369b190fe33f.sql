-- Enable realtime for bookings table
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;