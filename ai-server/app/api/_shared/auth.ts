import { timingSafeEqual } from 'node:crypto';
export function authorize(request: Request): Response | null {
  const secret=process.env.AI_SERVER_API_KEY;
  if(!secret) return Response.json({success:false,error:'Server authentication is not configured'},{status:503});
  const supplied=Buffer.from(request.headers.get('authorization')||'');
  const expected=Buffer.from(`Bearer ${secret}`);
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))
    return Response.json({success:false,error:'Unauthorized'},{status:401});
  return null;
}
