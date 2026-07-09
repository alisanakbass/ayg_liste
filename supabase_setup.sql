-- Profiles tablosu
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Orders tablosu
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    customer_address TEXT NOT NULL,
    urgency TEXT NOT NULL,
    status TEXT NOT NULL,
    created_by TEXT NOT NULL,
    recipient TEXT,
    parent_order_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    picked_by TEXT,
    items JSONB NOT NULL,
    vehicle_plate TEXT,
    carried_material TEXT,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    latitude NUMERIC,
    longitude NUMERIC,
    destination_lat NUMERIC,
    destination_lng NUMERIC
);

-- Row Level Security (RLS) Etkinleştirme
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anonim erişim politikaları (Varsa önce silinir, sonra eklenir)
DROP POLICY IF EXISTS "Allow public select profiles" ON public.profiles;
CREATE POLICY "Allow public select profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert profiles" ON public.profiles;
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete profiles" ON public.profiles;
CREATE POLICY "Allow public delete profiles" ON public.profiles FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public select orders" ON public.orders;
CREATE POLICY "Allow public select orders" ON public.orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert orders" ON public.orders;
CREATE POLICY "Allow public insert orders" ON public.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update orders" ON public.orders;
CREATE POLICY "Allow public update orders" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete orders" ON public.orders;
CREATE POLICY "Allow public delete orders" ON public.orders FOR DELETE USING (true);

-- Realtime yayını (Publication) etkinleştirme (Varsa ekleme yapmaz)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND n.nspname = 'public' 
      AND c.relname = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND n.nspname = 'public' 
      AND c.relname = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- Mevcut veritabanını güncellemek için alter sorguları
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS carried_material TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS destination_lat NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS destination_lng NUMERIC;

-- Vehicles (Araçlar) tablosu tanımı
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate TEXT NOT NULL UNIQUE,
    photo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS) Etkinleştirme
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Politikalar
DROP POLICY IF EXISTS "Allow anonymous read access to vehicles" ON public.vehicles;
CREATE POLICY "Allow anonymous read access to vehicles" ON public.vehicles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert access to vehicles" ON public.vehicles;
CREATE POLICY "Allow anonymous insert access to vehicles" ON public.vehicles
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous update access to vehicles" ON public.vehicles;
CREATE POLICY "Allow anonymous update access to vehicles" ON public.vehicles
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous delete access to vehicles" ON public.vehicles;
CREATE POLICY "Allow anonymous delete access to vehicles" ON public.vehicles
    FOR DELETE USING (true);

-- Realtime yayınına ekleme
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND n.nspname = 'public' 
      AND c.relname = 'vehicles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
  END IF;
END $$;

-- Attendance (Giriş/Çıkış Logları) Tablosu
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_name TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'Giriş' veya 'Çıkış'
    late_status TEXT,          -- 'Zamanında', 'Geç Kaldı', 'Erken Çıktı', 'Fazla Mesai'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Shift Settings (Vardiya Saatleri) Tablosu
CREATE TABLE IF NOT EXISTS public.shift_settings (
    day_index INT PRIMARY KEY, -- 0: Pazar, 1: Pazartesi ... 6: Cumartesi
    day_name TEXT NOT NULL,
    start_time TIME NOT NULL DEFAULT '08:30:00',
    end_time TIME NOT NULL DEFAULT '18:00:00',
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Notifications (Uyarı ve Bildirimler) Tablosu
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_name TEXT NOT NULL, -- Personel ismi veya 'Tümü'
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Politikaları
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select attendance" ON public.attendance;
CREATE POLICY "Allow public select attendance" ON public.attendance FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert attendance" ON public.attendance;
CREATE POLICY "Allow public insert attendance" ON public.attendance FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete attendance" ON public.attendance;
CREATE POLICY "Allow public delete attendance" ON public.attendance FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public select shift_settings" ON public.shift_settings;
CREATE POLICY "Allow public select shift_settings" ON public.shift_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert shift_settings" ON public.shift_settings;
CREATE POLICY "Allow public insert shift_settings" ON public.shift_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update shift_settings" ON public.shift_settings;
CREATE POLICY "Allow public update shift_settings" ON public.shift_settings FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select notifications" ON public.notifications;
CREATE POLICY "Allow public select notifications" ON public.notifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert notifications" ON public.notifications;
CREATE POLICY "Allow public insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update notifications" ON public.notifications;
CREATE POLICY "Allow public update notifications" ON public.notifications FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete notifications" ON public.notifications;
CREATE POLICY "Allow public delete notifications" ON public.notifications FOR DELETE USING (true);

-- Varsayılan vardiya saatlerini doldur (Eğer tablo boşsa)
INSERT INTO public.shift_settings (day_index, day_name, start_time, end_time, is_active)
VALUES 
  (1, 'Pazartesi', '08:30:00', '18:00:00', true),
  (2, 'Salı', '08:30:00', '18:00:00', true),
  (3, 'Çarşamba', '08:30:00', '18:00:00', true),
  (4, 'Perşembe', '08:30:00', '18:00:00', true),
  (5, 'Cuma', '08:30:00', '18:00:00', true),
  (6, 'Cumartesi', '08:30:00', '13:00:00', true),
  (0, 'Pazar', '00:00:00', '00:00:00', false)
ON CONFLICT (day_index) DO NOTHING;

-- Realtime yayınına ekleme
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND n.nspname = 'public' 
      AND c.relname = 'attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND n.nspname = 'public' 
      AND c.relname = 'shift_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_settings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND n.nspname = 'public' 
      AND c.relname = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;


