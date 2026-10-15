import { investigate } from '../supabase/functions/campuscare/ai-client.ts';
import { analyzeTeam } from '../supabase/functions/campuscare/team-ai.ts';
const teamUrl=Deno.env.get('AI_SERVER_URL');
const url=Deno.env.get('UBOT_URL');
const key=Deno.env.get('UBOT_API_KEY');
if(!teamUrl&&(!url||!key)) {
  console.error('Set AI_SERVER_URL (team server), or UBOT_URL and UBOT_API_KEY. No request sent.');
  Deno.exit(1);
}
try {
  // Synthetic report only: does not connect to or mutate the campus database.
  const result=teamUrl ? await analyzeTeam(teamUrl,{text:'ทดสอบระบบ: หลอดไฟทางเดินดับหนึ่งดวง'},Deno.env.get('AI_SERVER_API_KEY')||'',fetch,Deno.args.includes('--local')) : await investigate(url!,key!,{
    report:{description:'ทดสอบระบบ: หลอดไฟทางเดินดับหนึ่งดวง',transcript:'',location_id:null,location_text:'จุดทดสอบระบบ',image_urls:[]},
    candidates:[],
  });
  console.log('PASS: AI endpoint accepted the request and returned valid structured data.');
  console.log(`Category: ${result.category}; severity: ${result.severity}; duplicate: ${result.duplicate_issue_id===null?'none':'matched'}`);
} catch(error) {
  // Do not print URLs, credentials, provider response bodies, or user content.
  const message=error instanceof Error?error.message:'';
  console.error(/^AI server returned HTTP \d+$/.test(message)?message:'FAIL: Could not obtain a valid AI response. Check connectivity and docs/API.md with the AI teammate.');
  Deno.exit(1);
}
