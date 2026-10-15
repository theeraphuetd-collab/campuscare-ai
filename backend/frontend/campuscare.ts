// Copy into your Next.js project; install @supabase/supabase-js.
// Browser client only. Server components must use a separate SSR client.
'use client';
import { createClient } from '@supabase/supabase-js';
import type {Dashboard,Issue,IssueStatus,Report} from './types';

export const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
export async function signIn() {
  const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{
    redirectTo:`${window.location.origin}/auth/callback`,queryParams:{hd:'kmitl.ac.th',prompt:'select_account'}
  }});
  if(error) throw error;
}
export async function api<T=unknown>(path: string, options: RequestInit={}): Promise<T> {
  const {data:{session}}=await supabase.auth.getSession();
  if(!session) throw new Error('กรุณาเข้าสู่ระบบ');
  const headers=new Headers(options.headers);
  headers.set('Authorization',`Bearer ${session.access_token}`);
  headers.set('apikey',process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  if(typeof options.body==='string') headers.set('Content-Type','application/json');
  const base=process.env.NEXT_PUBLIC_CAMPUSCARE_API_URL||`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/campuscare`;
  const response=await fetch(`${base.replace(/\/$/,'')}/${path}`,{...options,headers});
  if(!response.ok) { const body=await response.json();throw new Error(body.error||'Request failed'); }
  return (response.headers.get('content-type')?.includes('audio/')?await response.blob():await response.json()) as T;
}
export async function submitReport(input: {client_request_id: string;description?:string;location_id?:string;location_text?:string},files: File[]=[]) {
  // Keep the same client_request_id when retrying creation, e.g. save it in component state.
  const report=await api<{id:string}>('reports',{method:'POST',body:JSON.stringify(input)});
  for(const file of files) {
    const form=new FormData();form.set('file',file);
    await api(`reports/${report.id}/attachments`,{method:'POST',body:form});
  }
  // Show receipt now; processing is a separate call so slow AI never loses the report.
  return report;
}
export const processReport=(id:string)=>api(`reports/${id}/process`,{method:'POST'});
export const confirmationAudio=(id:string)=>api<Blob>(`reports/${id}/confirmation`,{method:'POST'});
export const dailyBriefingAudio=(date:string)=>api<Blob>(`briefing?date=${encodeURIComponent(date)}&audio=true`,{method:'POST'});
export const currentUser=()=>api<{id:string;email:string;role:'staff'|'student'}>('me');
export const locations=()=>api<{id:string;name:string}[]>('locations');
export const listReports=(offset=0)=>api<Report[]>(`reports?offset=${offset}`);
export const getReport=(id:string)=>api<Report>(`reports/${id}`);
export const listIssues=(offset=0)=>api<Issue[]>(`issues?offset=${offset}`);
export const updateIssue=(id:string,status:IssueStatus)=>api<Issue>(`issues/${id}`,{method:'PATCH',body:JSON.stringify({status})});
export const dashboard=(date:string)=>api<Dashboard>(`dashboard?date=${encodeURIComponent(date)}`);
export const briefingText=(date:string)=>api<{date:string;text:string}>(`briefing?date=${encodeURIComponent(date)}`,{method:'POST'});
// Audio playback must be triggered by the user's gesture; expose visible transcript and retry controls.
