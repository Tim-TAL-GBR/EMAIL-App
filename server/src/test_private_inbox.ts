import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    const existingUser = users?.users.find(u => u.email === 'intern@ballettstore24.de');
    const userId = existingUser?.id;

    if (!userId) return console.error('User not found');

    const { data: teamMember } = await supabase.from('team_members').select('team_id').eq('user_id', userId).single();

    if (!teamMember) return console.error('Team member not found');

    console.log('Inserting private inbox...');
    const { data, error } = await supabase.from('inboxes').insert({
        team_id: teamMember.team_id,
        name: 'Private Inbox Test',
        email_address: 'private@ballettstore24.de',
        type: 'private',
        owner_id: userId,
        color: '#ff0000'
    }).select().single();

    if (error) {
        console.error('Insert Error:', error);
    } else {
        console.log('Success:', data);
        await supabase.from('inboxes').delete().eq('id', data.id);
    }
}
main();
