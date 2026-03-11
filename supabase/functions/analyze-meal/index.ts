import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Autentificering ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Mangler Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    // Valider JWT via anon client
    const supabaseAnon = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Ikke autoriseret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client til DB og storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { image_base64, date } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: "Mangler image_base64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = date ?? new Date().toISOString().split("T")[0];

    // --- Upload billede til Storage ---
    const imageBytes = Uint8Array.from(atob(image_base64), (c) => c.charCodeAt(0));
    const fileName = `${user.id}/${today}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("meal-images")
      .upload(fileName, imageBytes, { contentType: "image/jpeg", upsert: false });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: "Upload fejlede: " + uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from("meal-images")
      .getPublicUrl(fileName);

    // --- Kald Claude Vision API ---
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: image_base64 },
            },
            {
              type: "text",
              text: `Du er en ernæringsanalytiker for en sundhedskonkurrence-app for teenagedrenge.
Analysér billedet af et måltid. Vær ærlig og konsekvent.
Svar KUN i dette JSON-format, ingen anden tekst:
{
  "meal_name": "Kort beskrivelse på dansk",
  "has_vegetables": boolean,
  "has_protein_source": boolean,
  "has_fruit": boolean,
  "is_ultra_processed": boolean,
  "is_homemade": boolean,
  "meal_quality": "good" | "mid" | "bad",
  "confidence": "high" | "medium" | "low",
  "items_detected": ["item1", "item2"]
}
Regler:
- "good" = overvejende sunde, hele fødevarer
- "mid" = blandet eller neutralt
- "bad" = overvejende junkfood, fastfood, slik
- Ultra-processed = NOVA klasse 4 (chips, sodavand, nuggets, slik, kage osv.)
- Protein source = kød, fisk, æg, bønner, tofu, protein-shake synlig
- Vær streng men fair. En salat med kylling er "good". En pizza er "mid". McDonalds er "bad".`,
            },
          ],
        }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return new Response(JSON.stringify({ error: "Claude API fejl: " + err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text ?? "";

    // Parse JSON — rens eventuelle markdown-blokke fra Claude
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Kunne ikke parse Claude-svar", raw: rawText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const analysis = JSON.parse(jsonMatch[0]);

    // --- Beregn meal_score ---
    let meal_score = 0;
    if (analysis.has_vegetables)      meal_score += 2;
    if (analysis.has_protein_source)  meal_score += 2;
    if (analysis.has_fruit)           meal_score += 1;
    if (analysis.is_homemade)         meal_score += 2;
    if (!analysis.is_ultra_processed) meal_score += 2;
    if (analysis.is_ultra_processed)  meal_score -= 3;
    if (analysis.meal_quality === "good") meal_score += 3;
    if (analysis.meal_quality === "bad")  meal_score -= 2;

    // --- Gem måltid i meals ---
    const { data: meal, error: mealError } = await supabase
      .from("meals")
      .insert({
        user_id:            user.id,
        date:               today,
        image_url:          publicUrl,
        meal_name:          analysis.meal_name,
        has_vegetables:     analysis.has_vegetables,
        has_protein_source: analysis.has_protein_source,
        has_fruit:          analysis.has_fruit,
        is_ultra_processed: analysis.is_ultra_processed,
        is_homemade:        analysis.is_homemade,
        meal_quality:       analysis.meal_quality,
        ai_confidence:      analysis.confidence,
        items_detected:     analysis.items_detected ?? [],
        meal_score,
      })
      .select()
      .single();

    if (mealError) {
      return new Response(JSON.stringify({ error: "DB fejl: " + mealError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Genberegn dagens kost_score (alle måltider inkl. det nye) ---
    const { data: allMeals } = await supabase
      .from("meals")
      .select("meal_score, is_ultra_processed")
      .eq("user_id", user.id)
      .eq("date", today);

    const mealCount    = allMeals?.length ?? 0;
    const rawKostScore = allMeals?.reduce((sum, m) => sum + (m.meal_score ?? 0), 0) ?? 0;
    const hasAnyUPF    = allMeals?.some((m) => m.is_ultra_processed) ?? false;

    let kost_score = rawKostScore;
    if (mealCount >= 3)               kost_score += 5; // 3+ måltider bonus
    if (!hasAnyUPF && mealCount > 0)  kost_score += 5; // 0 UPF bonus

    // --- Opdater daily_scores ---
    // Hent eksisterende scores for at bevare de andre kategorier
    const { data: existingScore } = await supabase
      .from("daily_scores")
      .select("sleep_score, fysik_score, disciplin_score, screen_score, hygiejne_score")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const sleep_score     = existingScore?.sleep_score     ?? 0;
    const fysik_score     = existingScore?.fysik_score     ?? 0;
    const disciplin_score = existingScore?.disciplin_score ?? 0;
    const screen_score    = existingScore?.screen_score    ?? 0;
    const hygiejne_score  = existingScore?.hygiejne_score  ?? 0;
    const total_score     = sleep_score + fysik_score + disciplin_score + screen_score + hygiejne_score + kost_score;

    await supabase
      .from("daily_scores")
      .upsert(
        {
          user_id:        user.id,
          date:           today,
          sleep_score,
          fysik_score,
          disciplin_score,
          screen_score,
          hygiejne_score,
          kost_score,
          total_score,
        },
        { onConflict: "user_id,date" }
      );

    return new Response(
      JSON.stringify({
        meal,
        kost_score,
        meal_count: mealCount,
        bonuses: {
          three_meals: mealCount >= 3,
          no_upf:      !hasAnyUPF && mealCount > 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
