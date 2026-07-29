import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";

export const aiRouter: Router = Router();
aiRouter.use(requireAuth);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireOrgAdmin(orgId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data && ["owner", "admin"].includes(data.role);
}

async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function resolveOrgId(inboxId?: string): Promise<string | null> {
  if (!inboxId) return null;
  const supabase = getSupabaseAdmin();
  const { data: inbox } = await supabase
    .from("inboxes")
    .select("team_id")
    .eq("id", inboxId)
    .single();
  if (!inbox?.team_id) return null;
  const { data: team } = await supabase
    .from("teams")
    .select("parent_id")
    .eq("id", inbox.team_id)
    .single();
  return team?.parent_id || inbox.team_id;
}

async function getOpenAIKey(userId: string, orgId?: string | null): Promise<{ apiKey: string; model: string; settings: Record<string, any> }> {
  const supabase = getSupabaseAdmin();
  let settings: Record<string, any> = {};

  // Always fetch org settings when orgId is present (rules are org-level)
  if (orgId) {
    const { data: orgSettings } = await supabase
      .from("org_ai_settings")
      .select("openai_api_key, openai_model, settings")
      .eq("org_id", orgId)
      .maybeSingle();
    settings = (orgSettings?.settings as Record<string, any>) || {};

    // Prefer org-level key
    if (orgSettings?.openai_api_key) {
      return {
        apiKey: orgSettings.openai_api_key,
        model: orgSettings.openai_model || process.env.OPENAI_MODEL || "gpt-4o-mini",
        settings,
      };
    }
  }

  // Fallback to user-level key
  const { data } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();
  const prefs = (data?.preferences as Record<string, any>) || {};
  const apiKey = prefs.openai_api_key || process.env.OPENAI_API_KEY || "";
  const model = prefs.openai_model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  return { apiKey, model, settings };
}

async function getContext(userId: string, orgId?: string | null): Promise<{ topic: string; content: string }[]> {
  const supabase = getSupabaseAdmin();
  const results: { topic: string; content: string }[] = [];

  // Org-level context
  if (orgId) {
    const { data: orgCtx } = await supabase
      .from("org_ai_context")
      .select("topic, content")
      .eq("org_id", orgId)
      .order("created_at");
    if (orgCtx) results.push(...orgCtx);
  }

  // User-level context (appended after org context)
  const { data: userCtx } = await supabase
    .from("ai_context")
    .select("topic, content")
    .eq("user_id", userId)
    .order("created_at");
  if (userCtx) results.push(...userCtx);

  return results;
}

async function callOpenAI(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  if (!apiKey) {
    throw new Error("OpenAI API Key nicht konfiguriert – in den Einstellungen hinterlegen");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API Fehler (${res.status}): ${err}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// User-level context (backward compat)
// ---------------------------------------------------------------------------

aiRouter.get("/context", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_context")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ entries: data ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

aiRouter.post("/context", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { topic, content } = req.body;
    if (!topic || !content) {
      res.status(400).json({ error: "topic and content are required" });
      return;
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_context")
      .insert({ user_id: userId, topic, content })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ entry: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

aiRouter.put("/context/:id", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;
    const { topic, content } = req.body;
    const supabase = getSupabaseAdmin();
    const existing = await supabase
      .from("ai_context")
      .select("user_id")
      .eq("id", id)
      .single();
    if (existing.error || existing.data?.user_id !== userId) {
      res.status(403).json({ error: "Not found or unauthorized" });
      return;
    }
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    if (topic !== undefined) updates.topic = topic;
    if (content !== undefined) updates.content = content;
    const { data, error } = await supabase
      .from("ai_context")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ entry: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

aiRouter.delete("/context/:id", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    const existing = await supabase
      .from("ai_context")
      .select("user_id")
      .eq("id", id)
      .single();
    if (existing.error || existing.data?.user_id !== userId) {
      res.status(403).json({ error: "Not found or unauthorized" });
      return;
    }
    const { error } = await supabase.from("ai_context").delete().eq("id", id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Org-level settings
// ---------------------------------------------------------------------------

aiRouter.get("/org/:orgId/settings", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { orgId } = req.params;

    if (!(await isOrgMember(orgId, userId))) {
      res.status(403).json({ error: "Kein Zugriff auf diese Organisation" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("org_ai_settings")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ settings: data ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

aiRouter.put("/org/:orgId/settings", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { orgId } = req.params;

    if (!(await requireOrgAdmin(orgId, userId))) {
      res.status(403).json({ error: "Nur Admins können die KI-Einstellungen bearbeiten" });
      return;
    }

    const { openai_api_key, openai_model, settings } = req.body;
    const supabase = getSupabaseAdmin();

    // Fetch existing row to merge settings and get id
    const { data: existing } = await supabase
      .from("org_ai_settings")
      .select("id, settings")
      .eq("org_id", orgId)
      .maybeSingle();

    const mergedSettings = { ...((existing?.settings as Record<string, any>) || {}), ...(settings || {}) };

    const record: any = {
      org_id: orgId,
      openai_api_key: openai_api_key ?? null,
      openai_model: openai_model ?? "gpt-4o-mini",
      settings: mergedSettings,
      updated_at: new Date().toISOString(),
    };
    if (existing?.id) record.id = existing.id;

    const { data, error } = await supabase
      .from("org_ai_settings")
      .upsert(record, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ settings: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Org-level context
// ---------------------------------------------------------------------------

aiRouter.get("/org/:orgId/context", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { orgId } = req.params;

    if (!(await isOrgMember(orgId, userId))) {
      res.status(403).json({ error: "Kein Zugriff auf diese Organisation" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("org_ai_context")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ entries: data ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

aiRouter.post("/org/:orgId/context", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { orgId } = req.params;
    const { topic, content } = req.body;

    if (!(await requireOrgAdmin(orgId, userId))) {
      res.status(403).json({ error: "Nur Admins können Kontext-Einträge verwalten" });
      return;
    }
    if (!topic || !content) {
      res.status(400).json({ error: "topic and content are required" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("org_ai_context")
      .insert({ org_id: orgId, topic, content })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ entry: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

aiRouter.put("/org/:orgId/context/:id", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { orgId, id } = req.params;

    if (!(await requireOrgAdmin(orgId, userId))) {
      res.status(403).json({ error: "Nur Admins können Kontext-Einträge bearbeiten" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const existing = await supabase
      .from("org_ai_context")
      .select("org_id")
      .eq("id", id)
      .single();
    if (existing.error || existing.data?.org_id !== orgId) {
      res.status(403).json({ error: "Not found or unauthorized" });
      return;
    }

    const { topic, content } = req.body;
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    if (topic !== undefined) updates.topic = topic;
    if (content !== undefined) updates.content = content;

    const { data, error } = await supabase
      .from("org_ai_context")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ entry: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

aiRouter.delete("/org/:orgId/context/:id", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { orgId, id } = req.params;

    if (!(await requireOrgAdmin(orgId, userId))) {
      res.status(403).json({ error: "Nur Admins können Kontext-Einträge löschen" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const existing = await supabase
      .from("org_ai_context")
      .select("org_id")
      .eq("id", id)
      .single();
    if (existing.error || existing.data?.org_id !== orgId) {
      res.status(403).json({ error: "Not found or unauthorized" });
      return;
    }

    const { error } = await supabase.from("org_ai_context").delete().eq("id", id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Suggest (uses org-level key + context when an inbox is specified)
// ---------------------------------------------------------------------------

async function fetchShopifyCustomer(email: string, teamId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: rawConnection } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("team_id", teamId)
      .limit(1)
      .maybeSingle();

    if (!rawConnection) return null;

    let accessToken = rawConnection.access_token;
    if (accessToken && !accessToken.startsWith("shpat_")) {
      try {
        const { decrypt } = await import("../utils/encryption.js");
        accessToken = decrypt(accessToken);
      } catch {}
    }

    const shop_domain = rawConnection.shop_domain;
    if (!accessToken || !shop_domain) return null;

    const emailMatch = email.match(/<([^>]+)>/) || [null, email];
    const cleanEmail = emailMatch[1]!;

    const gqlQuery = `
      query getCustomer($email: String!) {
        customers(first: 1, query: $email) {
          edges {
            node {
              id
              firstName
              lastName
              email
              amountSpent { amount currencyCode }
              numberOfOrders
            }
          }
        }
      }
    `;
    const ordersQuery = `
      query getOrdersByEmail($query: String!) {
        orders(first: 5, query: $query, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet { shopMoney { amount currencyCode } }
            }
          }
        }
      }
    `;

    const apiRes = await fetch(`https://${shop_domain}/admin/api/2025-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: gqlQuery, variables: { email: `email:${cleanEmail}` } }),
    });
    const apiJson = await apiRes.json();
    const customer = apiJson?.data?.customers?.edges?.[0]?.node;
    if (!customer) return null;

    let orders: any[] = [];
    if (customer.numberOfOrders !== "0") {
      const ordersRes = await fetch(`https://${shop_domain}/admin/api/2025-04/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query: ordersQuery, variables: { query: `email:${cleanEmail}` } }),
      });
      const ordersJson = await ordersRes.json();
      orders = ordersJson?.data?.orders?.edges?.map((e: any) => e.node) || [];
    }

    let result = `Shopify Kunde: ${customer.firstName || ""} ${customer.lastName || ""} (${customer.email})\n`;
    result += `Ausgegeben gesamt: ${customer.amountSpent?.amount || "0"} ${customer.amountSpent?.currencyCode || "EUR"}\n`;
    result += `Anzahl Bestellungen: ${customer.numberOfOrders}\n`;

    if (orders.length > 0) {
      result += `\nLetzte Bestellungen:\n`;
      for (const order of orders) {
        result += `- ${order.name} vom ${order.createdAt?.substring(0, 10)} | `;
        result += `Status: ${order.displayFinancialStatus || "unbekannt"} / ${order.displayFulfillmentStatus || "unbekannt"} | `;
        result += `Summe: ${order.totalPriceSet?.shopMoney?.amount || "?"} ${order.totalPriceSet?.shopMoney?.currencyCode || "EUR"}\n`;
      }
    }

    return result;
  } catch (err) {
    console.error("[AI] Shopify fetch error:", err);
    return null;
  }
}

aiRouter.post("/suggest", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { subject, bodyText, fromAddress, templates, inboxId } = req.body;

    if (!subject && !bodyText) {
      res.status(400).json({ error: "subject or bodyText required" });
      return;
    }

    const orgId = await resolveOrgId(inboxId);

    const contextEntries = await getContext(userId, orgId);

    let systemPrompt = "Du bist ein professioneller E-Mail-Assistent. ";
    systemPrompt += "Du hilfst dem Benutzer, eine Antwort auf eine eingehende E-Mail zu formulieren. ";
    systemPrompt += "Befolge die im user prompt genannten Regeln strikt – sie haben höchste Priorität. ";
    systemPrompt += "Antworte ausschließlich mit dem Textvorschlag, ohne Einleitung, Anführungszeichen oder Erklärung.\n\n";

    if (contextEntries.length > 0) {
      systemPrompt += "=== KONTEXT (Organisation & Benutzer) ===\n";
      for (const entry of contextEntries) {
        systemPrompt += `\nThema: ${entry.topic}\n${entry.content}\n`;
      }
      systemPrompt += "\n";
    }

    if (templates && templates.length > 0) {
      systemPrompt += "=== VORLAGEN (als Stil-Vorbild nutzen) ===\n";
      for (const tpl of templates.slice(0, 5)) {
        systemPrompt += `\n--- ${tpl.name} ---\n`;
        if (tpl.subject) systemPrompt += `Betreff: ${tpl.subject}\n`;
        systemPrompt += `${tpl.body}\n`;
      }
      systemPrompt += "\n";
    }

    const supabase = getSupabaseAdmin();
    let teamId: string | null = null;
    if (inboxId) {
      const { data: inbox } = await supabase
        .from("inboxes")
        .select("team_id")
        .eq("id", inboxId)
        .single();
      teamId = inbox?.team_id ?? null;
    }

    if (teamId && fromAddress) {
      const shopifyInfo = await fetchShopifyCustomer(fromAddress, teamId);
      if (shopifyInfo) {
        systemPrompt += "=== SHOPIFY KUNDENDATEN ===\n";
        systemPrompt += shopifyInfo + "\n\n";
      }
    }

    const { apiKey, model, settings } = await getOpenAIKey(userId, orgId);

    // Build user prompt with rules first, then the email to reply to
    let userPrompt = "";
    if (settings) {
      const rules: string[] = [];
      if (settings.no_greeting === true) rules.push("Beginne die Antwort direkt mit dem ersten Satz – absolut keine Anrede, kein 'Sehr geehrte/r', 'Hallo', 'Liebe/r', 'Guten Tag' oder ähnliches.");
      else rules.push("Beginne die Antwort mit einer passenden Anrede (z. B. 'Sehr geehrte/r', 'Hallo' o. Ä.).");
      if (settings.no_signature === true) rules.push("Beende die Antwort direkt mit dem letzten Satz – absolut keine Abschlussformel, kein 'Mit freundlichen Grüßen', 'Viele Grüße', 'Beste Grüße', 'Mit besten Wünschen', 'Liebe Grüße' oder ähnliches. Keine Signatur, kein Name am Ende.");
      else rules.push("Beende die Antwort mit einer passenden Abschlussformel (z. B. 'Mit freundlichen Grüßen').");
      if (settings.salutation_form === 'informal') rules.push("Verwende durchgehend die 'Du'-Anrede.");
      else if (settings.salutation_form === 'formal') rules.push("Verwende durchgehend die Höflichkeitsform 'Sie'.");
      if (settings.include_customer_name) rules.push("Sprich den Kunden mit Namen an, sofern dieser bekannt ist.");
      if (settings.tone === 'friendly') rules.push("Schreibe in einem freundlichen, warmen und zuvorkommenden Ton.");
      else if (settings.tone === 'professional') rules.push("Schreibe in einem professionellen, sachlichen und höflichen Ton.");
      if (settings.allow_emoji) rules.push("Du darfst Emojis verwenden, um die Nachricht persönlicher zu gestalten.");
      else rules.push("Verwende keine Emojis.");
      if (settings.response_length === 'short') rules.push("Halte die Antwort kurz: maximal 2-3 Sätze.");
      else if (settings.response_length === 'detailed') rules.push("Die Antwort darf ausführlich und detailliert sein.");
      if (rules.length > 0) {
        userPrompt += "WICHTIG – Diese Regeln sind strikt zu befolgen:\n";
        userPrompt += rules.map((r) => `- ${r}`).join("\n");
        userPrompt += "\n\n";
      }
    }
    userPrompt += `Erstelle eine Antwort auf folgende E-Mail:\n\n`;
    if (fromAddress) userPrompt += `Von: ${fromAddress}\n`;
    if (subject) userPrompt += `Betreff: ${subject}\n`;
    if (bodyText) userPrompt += `\n${bodyText}\n`;

    const suggestion = await callOpenAI(apiKey, model, systemPrompt, userPrompt);
    res.json({ suggestion });
  } catch (err: any) {
    console.error("[AI Routes] suggest error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});
