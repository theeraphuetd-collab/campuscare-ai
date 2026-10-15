import { analyzeTeam, endpoint, speechTeam } from './team-ai.ts';
function assert(value:unknown){if(!value)throw new Error('Assertion failed');}
async function rejects(fn:()=>Promise<unknown>){let failed=false;try{await fn();}catch{failed=true;}assert(failed);}
const result={success:true,data:{location:'Building A',category:'electrical',severity_score:4,ai_summary:'Water on electrical outlet',reasoning:'Risk'}};
Deno.test('team duplicates must reference supplied candidates',async()=>{
  const response={...result,data:{...result.data,duplicate_issue_id:'known',duplicate_confidence:0.98}};
  const transport=(async()=>Response.json(response)) as typeof fetch;
  await rejects(()=>analyzeTeam('https://ai.example.test',{text:'test'},'',transport));
  const output=await analyzeTeam('https://ai.example.test',{text:'test',candidates:[{id:'known',title:'Water on electrical outlet',category:'electrical',location_text:'Building A'}]},'',transport);
  assert(output.duplicate_issue_id==='known'&&output.duplicate_confidence===0.98);
});
Deno.test('team contract maps fields and omits absent image without inventing duplicates',async()=>{
  const output=await analyzeTeam('https://ai.example.test',{text:'test'},'',(async(url,init)=>{
    assert(url==='https://ai.example.test/api/analyze');const body=JSON.parse(String(init?.body));
    assert(body.text==='test'&&!('image' in body));assert(!new Headers(init?.headers).has('Authorization'));
    return Response.json(result);
  }) as typeof fetch);
  assert(output.severity===4&&output.title===result.data.ai_summary&&output.duplicate_issue_id===null);
});
Deno.test('team images and optional bearer auth are forwarded',async()=>{
  await analyzeTeam('https://ai.example.test',{text:'test',image:'data:image/jpeg;base64,YQ=='},'key',(async(_url,init)=>{
    assert(JSON.parse(String(init?.body)).image==='data:image/jpeg;base64,YQ==');
    assert(new Headers(init?.headers).get('Authorization')==='Bearer key');return Response.json(result);
  }) as typeof fetch);
});
Deno.test('team errors, unsupported categories and invalid severity are rejected',async()=>{
  for(const body of [{success:false}, {...result,data:{...result.data,severity_score:10}}, {...result,data:{...result.data,category:'unknown'}}])
    await rejects(()=>analyzeTeam('https://ai.example.test',{text:'test'},'',(async()=>Response.json(body)) as typeof fetch));
  await rejects(()=>analyzeTeam('http://localhost:3000',{text:'test'}));
  assert(endpoint('http://localhost:3000','/api/analyze',true)==='http://localhost:3000/api/analyze');
});
Deno.test('team TTS preserves audio type and rejects JSON responses',async()=>{
  const audio=await speechTeam('https://ai.example.test','hello','',(async()=>new Response('audio',{headers:{'Content-Type':'audio/wav'}})) as typeof fetch);
  assert(audio.headers.get('Content-Type')==='audio/wav');await audio.text();
  await rejects(()=>speechTeam('https://ai.example.test','hello','',(async()=>Response.json({error:'failed'})) as typeof fetch));
});
