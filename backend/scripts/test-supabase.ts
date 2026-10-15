const url=Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
const key=Deno.env.get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if(!url||!key) {console.error('Missing Supabase configuration');Deno.exit(1);}
try {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:') throw new Error('HTTPS required');
  const response=await fetch(new URL('/auth/v1/settings',parsed),{
    headers:{apikey:key},signal:AbortSignal.timeout(15000),redirect:'error',
  });
  if(!response.ok) {console.error(`Supabase configuration check returned HTTP ${response.status}`);Deno.exit(1);}
  const settings=await response.json();
  console.log('PASS: Supabase project reachable; public API key accepted.');
  console.log(`Google provider: ${settings.external?.google===true?'ENABLED':'NOT ENABLED'}`);
  console.log('Database migrations and OAuth credentials are not validated by this check.');
} catch(error) {
  console.error('Could not verify Supabase connectivity.');
  console.error(error instanceof Error?error.name:'UnknownError');Deno.exit(1);
}
