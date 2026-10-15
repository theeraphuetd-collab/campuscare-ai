// Run against a running AI server. Sends synthetic text; may use provider credits.
const base=process.env.AI_TEST_URL||'http://127.0.0.1:3001';
let failed=false;
for(const path of ['/api/analyze','/api/tts']) {
  try {
    const response=await fetch(new URL(path,base),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.AI_SERVER_API_KEY||''}`},body:JSON.stringify({text:path.endsWith('analyze')?'ทดสอบระบบ: หลอดไฟทางเดินอาคาร A ดับหนึ่งดวง':'ได้รับรายงานแล้ว ขอบคุณค่ะ'}),signal:AbortSignal.timeout(50000)});
    if(!response.ok) { console.log(`${path}: FAIL HTTP ${response.status}`);failed=true;await response.body?.cancel();continue; }
    if(path.endsWith('tts')) {
      const mime=response.headers.get('content-type')||'';
      const bytes=(await response.arrayBuffer()).byteLength;
      if(!mime.startsWith('audio/')||bytes===0) throw new Error('Invalid audio');
      console.log(`${path}: PASS ${mime}, ${bytes} bytes`);
    } else {
      const {success,data}=await response.json();
      if(success!==true||!data||!Number.isInteger(data.severity_score)||data.severity_score<1||data.severity_score>5) throw new Error('Invalid analysis');
      console.log(`${path}: PASS category=${data.category}, severity=${data.severity_score}`);
    }
  } catch {console.log(`${path}: FAIL connection, timeout, or invalid response`);failed=true;}
}
process.exitCode=failed?1:0;
