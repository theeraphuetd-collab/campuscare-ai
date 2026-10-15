import { validateAssessment } from './domain.ts';

export function endpoint(base: string, path: string, allowLocal = false) {
  const url=new URL(base);
  if(url.protocol!=='https:' && !(allowLocal && url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('AI server requires a public HTTPS URL');
  if(url.username||url.password||url.search||url.hash) throw new Error('Use an origin or base path without credentials or query');
  return `${url.href.replace(/\/$/,'')}${path}`;
}
export async function analyzeTeam(base: string, input: {text:string;image?:string;candidates?:{id:string;title:string;category:string;location_text:string}[]}, key='', transport: typeof fetch=fetch, allowLocal=false) {
  const headers: Record<string,string>={'Content-Type':'application/json'};
  if(key) headers.Authorization=`Bearer ${key}`;
  const response=await transport(endpoint(base,'/api/analyze',allowLocal),{
    method:'POST',headers,body:JSON.stringify(input),redirect:'error',signal:AbortSignal.timeout(45000),
  });
  if(!response.ok) throw new Error(`AI server returned HTTP ${response.status}`);
  const body=await response.json();
  if(body?.success!==true||!body.data||typeof body.data.ai_summary!=='string'||!body.data.ai_summary.trim()) throw new Error('Invalid team AI response');
  // This server does not return duplicate candidates: never invent a duplicate verdict.
  return validateAssessment({title:body.data.ai_summary.trim().slice(0,200),category:body.data.category,
    severity:body.data.severity_score,location_text:body.data.location,
    duplicate_issue_id:body.data.duplicate_issue_id||null,duplicate_confidence:body.data.duplicate_confidence??0},(input.candidates||[]).map(c=>c.id));
}
export async function speechTeam(base: string, text: string, key='', transport: typeof fetch=fetch, allowLocal=false) {
  const headers: Record<string,string>={'Content-Type':'application/json'};
  if(key) headers.Authorization=`Bearer ${key}`;
  const response=await transport(endpoint(base,'/api/tts',allowLocal),{method:'POST',headers,body:JSON.stringify({text}),redirect:'error',signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new Error(`AI server returned HTTP ${response.status}`);
  const mime=response.headers.get('Content-Type')||'';
  if(!mime.toLowerCase().startsWith('audio/')) throw new Error('AI TTS must return audio');
  return new Response(response.body,{headers:{'Content-Type':mime}});
}
