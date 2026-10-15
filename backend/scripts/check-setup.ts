// Reports configuration presence only. Never prints secret values or contacts services.
const required = ['ALLOWED_ORIGINS','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
 ...(Deno.env.get('AI_SERVER_URL')?['AI_SERVER_URL']:['UBOT_URL','UBOT_API_KEY','ELEVENLABS_VOICE_ID']),
 'ELEVENLABS_API_KEY']; // Still required for voice transcription; team server provides TTS only.
let missing = 0;
for(const name of required) {
  const value=Deno.env.get(name)?.trim();
  const ready=!!value&&!/YOUR_PROJECT|REPLACE_WITH/i.test(value);
  console.log(`${ready?'READY':'MISSING'} ${name}`);
  if(!ready) missing++;
}
console.log('No network requests made. Google OAuth, migrations and deployment must be verified separately.');
Deno.exit(missing?1:0);
