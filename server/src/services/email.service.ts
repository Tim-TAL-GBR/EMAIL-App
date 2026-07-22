import { getSupabaseAdmin } from "./auth.service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Email {
  id: string;
  inbox_id: string;
  subject: string | null;
  from_address: string;
  to_addresses: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Email Service
// ---------------------------------------------------------------------------

/**
 * Fetch a full email record by its ID.
 */
export async function getEmailById(emailId: string): Promise<Email | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .eq("id", emailId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("[email-service] getEmailById error:", error.message);
    return null;
  }

  return data as Email;
}

/**
 * Quick lookup: return only the `inbox_id` for a given email.
 *
 * This is optimised for access-guard checks where we don't need
 * the full email record.
 */
export async function getEmailInboxId(
  emailId: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("emails")
    .select("inbox_id")
    .eq("id", emailId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("[email-service] getEmailInboxId error:", error.message);
    return null;
  }

  return data?.inbox_id ?? null;
}
