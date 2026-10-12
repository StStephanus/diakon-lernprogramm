// Supabase Edge Function "reset-password"
// Setzt das Passwort eines Diakons neu – nur wenn das richtige Prüfer-Passwort mitgeschickt wird.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown) =>
  new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { userId, newPassword, prueferPassword } = await req.json();
    const expected = Deno.env.get("PRUEFER_PASSWORD");
    if (!expected || prueferPassword !== expected) return json({ error: "Nicht berechtigt." });
    if (!userId || typeof newPassword !== "string" || newPassword.length < 6)
      return json({ error: "Ungültige Eingabe (Passwort mindestens 6 Zeichen)." });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Nur Diakone mit Profil dürfen zurückgesetzt werden
    const { data: prof } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!prof) return json({ error: "Diakon nicht gefunden." });

    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return json({ error: "Zurücksetzen fehlgeschlagen: " + error.message });
    return json({ ok: true });
  } catch (_e) {
    return json({ error: "Fehler bei der Anfrage." });
  }
});
