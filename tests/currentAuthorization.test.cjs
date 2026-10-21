const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function harness({account={},profile={},restaurant=null}={}) {
  let revoked=0,updated;
  class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
  const auth={getUser:async()=>({disabled:false,tokensValidAfterTime:'1970-01-01',...account}),setCustomUserClaims:async(_uid,claims)=>{updated=claims;},revokeRefreshTokens:async()=>{revoked++;}};
  const db={collection:name=>({doc:()=>({get:async()=>({exists:name==='users'||!!restaurant,data:()=>name==='users'?profile:restaurant})})})};
  const module={exports:{}};
  const requireMock=name=>name==='firebase-admin/auth'?{getAuth:()=>auth}:name==='firebase-admin/firestore'?{getFirestore:()=>db}:{HttpsError};
  vm.runInNewContext(fs.readFileSync(require.resolve('../functions/src/lib/auth'),'utf8'),{require:requireMock,module,exports:module.exports,Date,console});
  return {...module.exports,revoked:()=>revoked,updated:()=>updated};
}
const request=(token={})=>({auth:{uid:'customer',token:{auth_time:Date.now()/1000,...token}}});
test('removed Food master claims cannot survive in a supplied token',async()=>{
  const h=harness();assert.equal((await h.resolveCaller(request({foodRole:'masterAdmin'}))).role,null);
});
test('current Food role and tenant replace stale token values',async()=>{
  const h=harness({account:{customClaims:{foodRole:'restaurantOwner',foodRestaurantId:'current-owner'}}});
  const caller=await h.resolveCaller(request({foodRole:'masterAdmin',foodRestaurantId:'foreign-owner'}));
  assert.equal(caller.role,'restaurantOwner');assert.equal(caller.restaurantId,'current-owner');
});
test('disabled, suspended and revoked Food sessions are rejected',async()=>{
  for(const options of [{account:{disabled:true}},{profile:{isSuspended:true}},{account:{tokensValidAfterTime:new Date(Date.now()+10000).toISOString()}}]) {
    await assert.rejects(()=>harness(options).resolveCaller(request({foodRole:'masterAdmin'})),{code:'permission-denied'});
  }
  await assert.rejects(()=>harness().resolveCaller(request({auth_time:undefined})),{code:'permission-denied'});
});
test('legacy Food owner fallback requires the current verified owned restaurant',async()=>{
  const h=harness({profile:{isRestaurantAdmin:true},restaurant:{status:'Verified',ownerId:'customer'}});
  assert.equal((await h.resolveCaller(request())).role,'restaurantOwner');
  assert.equal((await harness({profile:{isRestaurantAdmin:true},restaurant:{status:'Verified',ownerId:'other'}}).resolveCaller(request())).role,null);
});
test('changing protected claims revokes refresh tokens',async()=>{
  const h=harness({account:{customClaims:{foodRole:'masterAdmin',other:true}}});
  await h.setUserClaims('customer',{foodRole:null});
  assert.equal(h.updated().other,true);assert.equal(h.updated().foodRole,undefined);assert.equal(h.revoked(),1);
});
