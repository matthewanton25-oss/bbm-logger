import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { BUCKET_NAME } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const path = formData.get("path") as string | null;

  if (!file || !path) {
    return NextResponse.json({ error: "Missing file or path" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
