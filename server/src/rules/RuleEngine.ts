import { getSupabaseAdmin } from "../services/auth.service.js";

export type RuleTriggerType = 'incoming' | 'outgoing' | 'user_action';
export type RuleMatchType = 'all' | 'any';

export interface RuleCondition {
  field: 'from' | 'to' | 'subject' | 'body';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with';
  value: string;
}

export interface RuleAction {
  type: 'add_label' | 'mark_read' | 'archive' | 'star' | 'assign';
  value?: string;
}

export class RuleEngine {
  
  /**
   * Processes a newly received email through the rules engine.
   * Returns true if the email was archived/closed by a rule (to prevent push notifications).
   */
  public static async processIncomingEmail(emailId: string, inboxId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    let wasArchived = false;

    try {
      // 1. Fetch Email
      const { data: email } = await supabase
        .from('emails')
        .select('*')
        .eq('id', emailId)
        .single();
      
      if (!email) return false;

      // 2. Fetch Inbox to get team_id and owner_id
      const { data: inbox } = await supabase
        .from('inboxes')
        .select('team_id, owner_id')
        .eq('id', inboxId)
        .single();

      if (!inbox) return false;

      // 3. Fetch active rules for this inbox's team or owner
      let query = supabase
        .from('rules')
        .select('*')
        .eq('is_active', true)
        .eq('trigger_type', 'incoming');
      
      const orConditions = [];
      if (inbox.team_id) orConditions.push(`team_id.eq.${inbox.team_id}`);
      if (inbox.owner_id) orConditions.push(`owner_id.eq.${inbox.owner_id}`);

      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','));
      }

      const { data: rules, error: rulesError } = await query;
      
      if (rulesError || !rules || rules.length === 0) {
        return false;
      }

      console.log(`[RuleEngine] Evaluating ${rules.length} rules for email ${emailId}`);

      // 4. Evaluate Rules
      for (const rule of rules) {
        const conditions = rule.conditions as RuleCondition[];
        const actions = rule.actions as RuleAction[];
        const matchType = rule.conditions_match_type as RuleMatchType;

        let isMatch = false;

        if (conditions && conditions.length > 0) {
          const results = conditions.map(cond => this.evaluateCondition(cond, email));
          if (matchType === 'all') {
            isMatch = results.every(r => r === true);
          } else {
            isMatch = results.some(r => r === true);
          }
        } else {
          // If a rule has no conditions, it theoretically matches everything.
          // Depending on logic, we might want to skip or apply. Let's apply.
          isMatch = true;
        }

        if (isMatch) {
          console.log(`[RuleEngine] Rule "${rule.name}" matched for email ${emailId}`);
          
          for (const action of actions) {
            if (action.type === 'archive') {
              await supabase.from('emails').update({ status: 'done' }).eq('id', emailId);
              wasArchived = true;
            } else if (action.type === 'mark_read') {
              await supabase.from('emails').update({ is_read: true }).eq('id', emailId);
            } else if (action.type === 'star') {
              await supabase.from('emails').update({ is_starred: true }).eq('id', emailId);
            } else if (action.type === 'add_label' && action.value) {
              // Add label
              await supabase.from('email_labels').insert({
                email_id: emailId,
                label_id: action.value
              });
            } else if (action.type === 'assign' && action.value) {
              await supabase.from('email_assignments').insert({
                email_id: emailId,
                assigned_to: action.value,
                assigned_by: rule.owner_id || undefined // or system fallback
              });
            }
          }
        }
      }

    } catch (error) {
      console.error('[RuleEngine] Error processing email:', error);
    }

    return wasArchived;
  }

  private static evaluateCondition(cond: RuleCondition, email: any): boolean {
    let targetText = '';
    
    switch (cond.field) {
      case 'from':
        targetText = email.from_address || '';
        break;
      case 'to':
        targetText = (email.to_addresses || []).join(' ');
        break;
      case 'subject':
        targetText = email.subject || '';
        break;
      case 'body':
        targetText = email.body_text || '';
        break;
    }

    targetText = targetText.toLowerCase();
    const condValue = cond.value.toLowerCase();

    switch (cond.operator) {
      case 'equals':
        return targetText === condValue;
      case 'contains':
        return targetText.includes(condValue);
      case 'starts_with':
        return targetText.startsWith(condValue);
      case 'ends_with':
        return targetText.endsWith(condValue);
      default:
        return false;
    }
  }
}
