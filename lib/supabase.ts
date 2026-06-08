import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type FuelLog = {
  id: string;
  captain_name: string;
  boat_name: string;
  route: string;
  logged_at: string;
  liters: number;
  cost_idr: number;
  photo_before_url: string | null;
  photo_after_url: string | null;
  notes: string | null;
  created_at: string;
};
