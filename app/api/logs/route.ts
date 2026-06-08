import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const boat = searchParams.get("boat");
  const captain = searchParams.get("captain");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("fuel_logs")
    .select("*")
    .order("logged_at", { ascending: false });

  if (boat) query = query.eq("boat_name", boat);
  if (captain) query = query.eq("captain_name", captain);
  if (from) query = query.gte("logged_at", from);
  if (to) {
    // include the full "to" day
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);
    query = query.lt("logged_at", toDate.toISOString());
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, error } = await supabase
    .from("fuel_logs")
    .insert([body])
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
