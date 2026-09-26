import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AsdosLoginForm from "./asdos-login-form";

export const dynamic = "force-dynamic";

export default async function AsdosLoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("admin_profiles").select("role").eq("user_id", user.id).maybeSingle();
    if (profile?.role === "assistant") redirect("/asdos");
  }
  return <AsdosLoginForm />;
}
