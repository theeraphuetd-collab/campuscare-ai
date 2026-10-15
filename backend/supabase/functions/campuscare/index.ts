import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { bangkokDayBounds, briefingText } from './domain.ts';
import { investigate } from './ai-client.ts';
import { analyzeTeam, speechTeam } from './team-ai.ts';

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const env = (key: string) => { const value=Deno.env.get(key); if (!value) throw new HttpError(503,`${key} is not configured`); return value; };
const localAI=()=>Deno.env.get('ALLOW_LOCAL_AI')==='true'&&!Deno.env.get('DENO_DEPLOYMENT_ID');
const check = (error: unknown) => { if (error) { console.error('Database operation failed'); throw new HttpError(500,'Database operation failed'); } };
const uuid = (value: unknown): string => {
  if(typeof value!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400,'Invalid UUID'); return value;
};
function text(value: unknown, max: number, fallback='') {
  if(value===undefined) return fallback;
  if(typeof value!=='string'||value.length>max) throw new HttpError(400,'Invalid text');
  return value.trim();
}
async function jsonBody(req: Request) {
  if(Number(req.headers.get('content-length'))>20000) throw new HttpError(413,'Body too large');
  const raw=await req.text(); if(raw.length>20000) throw new HttpError(413,'Body too large');
  try { const value=JSON.parse(raw); if(!value||typeof value!=='object'||Array.isArray(value)) throw 0; return value; }
  catch { throw new HttpError(400,'Invalid JSON'); }
}
async function provider(url: string, init: RequestInit) {
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new HttpError(502,'External service unavailable'); return response;
}
async function speech(content: string) {
  const teamUrl=Deno.env.get('AI_SERVER_URL');
  if(teamUrl) return await speechTeam(teamUrl,content,Deno.env.get('AI_SERVER_API_KEY')||'',fetch,localAI());
  const response=await provider(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env('ELEVENLABS_VOICE_ID'))}`,{
    method:'POST',headers:{'xi-api-key':env('ELEVENLABS_API_KEY'),'Content-Type':'application/json',Accept:'audio/mpeg'},
    body:JSON.stringify({text:content,model_id:Deno.env.get('ELEVENLABS_TTS_MODEL')||'eleven_v3'})
  });
  return new Response(response.body,{headers:{'Content-Type':'audio/mpeg'}});
}

Deno.serve(async req=>{
  const origin=req.headers.get('origin');
  const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'http://localhost:3000').split(',').map(s=>s.trim());
  const headers: Record<string,string>={'Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS','Cache-Control':'no-store'};
  if(origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin']=origin;
  const respond=(body: unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
  const withHeaders=(response: Response)=>{ for(const [k,v] of Object.entries(headers)) response.headers.set(k,v); return response; };
  try {
    if(origin&&!allowed.includes(origin)) throw new HttpError(403,'Origin not allowed');
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
    const authorization=req.headers.get('authorization')||'';
    if(!/^Bearer \S+$/i.test(authorization)) throw new HttpError(401,'Sign in required');
    const supabaseUrl=Deno.env.get('SUPABASE_URL')||env('NEXT_PUBLIC_SUPABASE_URL');
    const admin=createClient(supabaseUrl,env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
    const token=authorization.slice(7);
    const {data:{user},error:authError}=await admin.auth.getUser(token);
    if(authError||!user||!user.email_confirmed_at||!user.identities?.some(i=>i.provider==='google')) throw new HttpError(401,'Verified Google account required');
    const {data:staffEntry,error:staffError}=await admin.from('staff_allowlist').select('email').eq('email',user.email?.toLowerCase()||'').maybeSingle();
    check(staffError);
    const staff=!!staffEntry;
    if(!staff&&!/^[0-9]{8}@kmitl\.ac\.th$/.test(user.email?.toLowerCase()||'')) throw new HttpError(403,'KMITL account required');
    const db=createClient(supabaseUrl,env('SUPABASE_SERVICE_ROLE_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const url=new URL(req.url);
    const parts=url.pathname.split('/').filter(Boolean);
    const base=parts.indexOf('campuscare');
    const path=parts.slice(base+1);
    const requireStaff=()=>{ if(!staff) throw new HttpError(403,'Staff access required'); };
    const getReport=async(id: string)=>{
      const {data,error}=await db.from('reports').select('*').eq('id',uuid(id)).maybeSingle(); check(error);
      if(!data) throw new HttpError(404,'Report not found'); return data;
    };
    if(req.method==='GET'&&path[0]==='me') return respond({id:user.id,email:user.email,role:staff?'staff':'student'});
    if(req.method==='GET'&&path[0]==='locations') {
      const {data,error}=await db.from('locations').select('*').order('name');check(error);return respond(data);
    }
    if(req.method==='POST'&&path.length===1&&path[0]==='reports') {
      const body=await jsonBody(req);
      const record={reporter_id:user.id,client_request_id:uuid(body.client_request_id),description:text(body.description,5000),location_text:text(body.location_text,300),location_id:body.location_id?uuid(body.location_id):null};
      const {data,error}=await db.from('reports').insert(record).select().single();
      if(error?.code==='23505') {
        const {data:existing,error:e}=await db.from('reports').select('*').eq('reporter_id',user.id).eq('client_request_id',record.client_request_id).single();check(e);return respond(existing);
      }
      check(error);return respond(data,201);
    }
    if(req.method==='GET'&&path[0]==='reports'&&path.length===1) {
      const offset=Math.floor(Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0)));
      const {data,error}=await db.from('reports').select('*,issues(*)').order('created_at',{ascending:false}).range(offset,offset+49);check(error);return respond(data);
    }
    if(req.method==='GET'&&path[0]==='reports'&&path.length===2) return respond(await getReport(path[1]));
    if(req.method==='POST'&&path[0]==='reports'&&path[2]==='attachments') {
      const report=await getReport(path[1]);
      if(report.reporter_id!==user.id) throw new HttpError(403,'Only the reporter may upload');
      if(!['pending','failed'].includes(report.processing_status)) throw new HttpError(409,'Report already processing or completed');
      const form=await req.formData();const file=form.get('file');
      const types: Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','audio/webm':'webm','audio/mpeg':'mp3','audio/wav':'wav','audio/mp4':'m4a','audio/ogg':'ogg'};
      const mime=file instanceof File?file.type.split(';')[0].trim().toLowerCase():'';
      if(!(file instanceof File)||!types[mime]||file.size===0||file.size>10485760) throw new HttpError(400,'Use an image or audio file up to 10 MB');
      const {count,error:countError}=await admin.from('report_attachments').select('id',{count:'exact',head:true}).eq('report_id',report.id);check(countError);
      if((count||0)>=5) throw new HttpError(409,'At most 5 attachments');
      const storage_path=`${user.id}/${report.id}/${crypto.randomUUID()}.${types[mime]}`;
      const {error:uploadError}=await admin.storage.from('report-media').upload(storage_path,file,{contentType:mime,upsert:false});check(uploadError);
      const {data,error}=await admin.from('report_attachments').insert({report_id:report.id,storage_path,kind:file.type.startsWith('audio/')?'audio':'image'}).select().single();
      if(error) await admin.storage.from('report-media').remove([storage_path]);check(error);return respond(data,201);
    }
    if(req.method==='GET'&&path[0]==='attachments'&&path[1]) {
      const {data,error}=await db.from('report_attachments').select('*').eq('id',uuid(path[1])).maybeSingle();check(error);
      if(!data) throw new HttpError(404,'Attachment not found');
      const {data:signed,error:e}=await admin.storage.from('report-media').createSignedUrl(data.storage_path,60);check(e);return respond(signed);
    }
    if(req.method==='POST'&&path[0]==='reports'&&path[2]==='process') {
      const report=await getReport(path[1]);
      if(report.processing_status==='completed') return respond({issue_id:report.issue_id,status:'completed'});
      const attempt=crypto.randomUUID();
      const {data:claimed,error:claimError}=await admin.rpc('claim_report',{p_report:report.id,p_attempt:attempt});check(claimError);
      if(!claimed) throw new HttpError(409,'Processing in progress; retry after 3 minutes if interrupted');
      try {
        const {data:attachments,error:e}=await admin.from('report_attachments').select('*').eq('report_id',report.id);check(e);
        // Rebuild from source recordings so retries never append the same transcript twice.
        let transcript='';
        const images: string[]=[];
        const teamUrl=Deno.env.get('AI_SERVER_URL');
        let teamImage: string | undefined;
        for(const attachment of attachments||[]) {
          if(attachment.kind==='audio') {
            const {data:blob,error:downloadError}=await admin.storage.from('report-media').download(attachment.storage_path);check(downloadError);
            const form=new FormData();form.set('file',blob!,attachment.storage_path.split('/').pop());form.set('model_id','scribe_v1');form.set('language_code','tha');
            const result=await (await provider('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':env('ELEVENLABS_API_KEY')},body:form})).json();
            transcript=[transcript,text(result.text,10000)].filter(Boolean).join('\n');
          } else if(teamUrl) {
            // Team endpoint accepts one data URI, not a signed image URL.
            if(!teamImage) {
              const {data:blob,error:imageError}=await admin.storage.from('report-media').download(attachment.storage_path);check(imageError);
              const bytes=new Uint8Array(await blob!.arrayBuffer());
              let binary='';for(let start=0;start<bytes.length;start+=8192) binary+=String.fromCharCode(...bytes.subarray(start,start+8192));
              teamImage=`data:${blob!.type};base64,${btoa(binary)}`;
            }
          } else {
            const {data:signed,error:signedError}=await admin.storage.from('report-media').createSignedUrl(attachment.storage_path,120);check(signedError);images.push(signed!.signedUrl);
          }
        }
        if(transcript.length>10000) throw new HttpError(400,'Transcript too long');
        const {error:transcriptError}=await admin.from('reports').update({transcript}).eq('id',report.id).eq('attempt_id',attempt);check(transcriptError);
        if(!report.description&&!transcript&&!images.length&&!teamImage) throw new HttpError(400,'Add text, an image, or an audio recording first');
        let query=admin.from('issues').select('id,title,category,severity,location_id,location_text').neq('status','resolved').order('created_at',{ascending:false}).limit(30);
        if(report.location_id) query=query.eq('location_id',report.location_id);
        const {data:candidates,error:candidateError}=await query;check(candidateError);
        const assessment=teamUrl ? await analyzeTeam(teamUrl,{
          candidates:candidates||[],
          text:[report.description,transcript,report.location_text ? `Reported location: ${report.location_text}` : ''].filter(Boolean).join('\n'),
          ...(teamImage?{image:teamImage}:{})
        },Deno.env.get('AI_SERVER_API_KEY')||'',fetch,localAI()) : await investigate(env('UBOT_URL'),env('UBOT_API_KEY'),{
          report:{description:report.description,transcript,location_id:report.location_id,location_text:report.location_text,image_urls:images},candidates:candidates||[]
        });
        const {error:updateError}=await admin.from('reports').update({transcript}).eq('id',report.id).eq('attempt_id',attempt);check(updateError);
        const {data:issue_id,error:finishError}=await admin.rpc('finish_report',{p_report:report.id,p_attempt:attempt,p_result:assessment});check(finishError);
        return respond({status:'completed',issue_id});
      } catch(error) {
        await admin.from('reports').update({processing_status:'failed'}).eq('id',report.id).eq('attempt_id',attempt).eq('processing_status','processing');
        throw error;
      }
    }
    if(req.method==='POST'&&path[0]==='reports'&&path[2]==='confirmation') {
      await getReport(path[1]);return withHeaders(await speech('ได้รับรายงานของคุณแล้ว เจ้าหน้าที่จะตรวจสอบข้อมูล ขอบคุณที่ช่วยดูแลมหาวิทยาลัยของเรา'));
    }
    if(req.method==='GET'&&path[0]==='issues') {
      requireStaff();
      const offset=Math.floor(Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0)));
      const {data,error}=await db.from('issues').select('*,reports(count)').order('severity',{ascending:false}).order('created_at',{ascending:false}).range(offset,offset+49);check(error);return respond(data);
    }
    if(req.method==='PATCH'&&path[0]==='issues'&&path[1]) {
      requireStaff();const body=await jsonBody(req);
      if(!['open','in_progress','resolved'].includes(body.status)) throw new HttpError(400,'Invalid status');
      const {data,error}=await db.from('issues').update({status:body.status}).eq('id',uuid(path[1])).select().maybeSingle();check(error);
      if(!data) throw new HttpError(404,'Issue not found');return respond(data);
    }
    if((req.method==='GET'&&path[0]==='dashboard')||(req.method==='POST'&&path[0]==='briefing')) {
      requireStaff();
      const date=url.searchParams.get('date')||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      let bounds;try { bounds=bangkokDayBounds(date); } catch { throw new HttpError(400,'Use a valid YYYY-MM-DD date'); }
      // SQL aggregation avoids PostgREST's default row cap.
      const {data,error}=await db.rpc('dashboard_summary',{p_start:bounds.start,p_end:bounds.end});check(error);
      if(req.method==='GET') return respond({date,...data});
      const summary=briefingText(data.issues,data.report_count,data.backlog_count,date);
      if(url.searchParams.get('audio')==='true') return withHeaders(await speech(summary));
      return respond({date,text:summary});
    }
    throw new HttpError(404,'Endpoint not found');
  } catch(error) {
    if(error instanceof HttpError) return respond({error:error.message},error.status);
    console.error('Request failed',error instanceof Error?error.name:'UnknownError');
    return respond({error:'Request failed; retry or contact staff'},502);
  }
});
