import { investigate, type Investigation } from './ai-client.ts';
const input: Investigation={report:{description:'test',transcript:'',location_id:null,location_text:'',image_urls:[]},candidates:[]};
const output={title:'Broken light',category:'electrical',severity:2,location_text:'unknown',duplicate_issue_id:null,duplicate_confidence:0};
function assert(value:unknown) { if(!value) throw new Error('Assertion failed'); }
async function rejects(fn:()=>Promise<unknown>) { let failed=false;try{await fn();}catch{failed=true;}assert(failed); }
Deno.test('AI transport sends the documented body and bearer token',async()=>{
  const transport=(async(url,init)=>{
    assert(url==='https://ai.example.test/investigate');
    assert(new Headers(init?.headers).get('Authorization')==='Bearer test-key');
    const body=JSON.parse(String(init?.body));
    assert(body.task==='investigate_campus_issue');assert(body.report.description==='test');assert(body.candidates.length===0);
    assert(init?.redirect==='error');
    return Response.json(output);
  }) as typeof fetch;
  assert((await investigate('https://ai.example.test/investigate','test-key',input,transport)).severity===2);
});
Deno.test('AI failures and invalid duplicate responses do not pass validation',async()=>{
  await rejects(()=>investigate('https://ai.example.test','key',input,(async()=>new Response('',{status:401})) as typeof fetch));
  await rejects(()=>investigate('https://ai.example.test','key',input,(async()=>Response.json({...output,duplicate_issue_id:'invented'})) as typeof fetch));
  await rejects(()=>investigate('http://ai.example.test','key',input));
  await rejects(()=>investigate('https://ai.example.test','',input));
});
