import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorize} from '../app/api/_shared/auth.ts';
test('AI endpoints reject unconfigured, missing and wrong credentials',()=>{
  const previous=process.env.AI_SERVER_API_KEY;
  try {
    delete process.env.AI_SERVER_API_KEY;
    assert.equal(authorize(new Request('https://test'))?.status,503);
    process.env.AI_SERVER_API_KEY='test-secret';
    assert.equal(authorize(new Request('https://test'))?.status,401);
    assert.equal(authorize(new Request('https://test',{headers:{Authorization:'Bearer wrong'}}))?.status,401);
    assert.equal(authorize(new Request('https://test',{headers:{Authorization:'Bearer test-secret'}})),null);
  } finally {if(previous===undefined)delete process.env.AI_SERVER_API_KEY;else process.env.AI_SERVER_API_KEY=previous;}
});
