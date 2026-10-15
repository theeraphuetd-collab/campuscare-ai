'use client';
// Copy to app/auth/callback/page.tsx and adjust the import path.
import { useEffect, useState } from 'react';
import { api, supabase } from './campuscare';
export default function AuthCallback() {
  const [message,setMessage]=useState('กำลังตรวจสอบบัญชี KMITL…');
  useEffect(()=>{
    let active=true;
    const run=async()=>{
      // The browser client handles OAuth tokens automatically. Verify membership with the backend.
      const {error}=await supabase.auth.getSession();if(error) throw error;
      await api('me');window.location.replace('/');
    };
    run().catch(async()=>{await supabase.auth.signOut();if(active)setMessage('เข้าสู่ระบบไม่สำเร็จ กรุณาใช้บัญชี Google ของ KMITL ที่ได้รับอนุญาต');});
    return ()=>{active=false;};
  },[]);
  return <main><p role="status">{message}</p><a href="/">กลับหน้าหลัก</a></main>;
}
