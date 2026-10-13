const {test,after}=require('node:test');const assert=require('node:assert/strict');
if(!process.env.FIRESTORE_EMULATOR_HOST||process.env.GCLOUD_PROJECT!=='demo-thaiseva-security')throw Error('Synthetic emulator project required');
const paths=[require('node:path').join(__dirname,'../functions')];
const {initializeApp,deleteApp}=require(require.resolve('firebase-admin/app',{paths}));
const {getFirestore}=require(require.resolve('firebase-admin/firestore',{paths}));
const app=initializeApp({projectId:'demo-thaiseva-security'});const db=getFirestore();
const {syncPartnerOrderView,backfillPartnerOrderViews}=require('../functions/src/lib/partnerOrderViews');
test('partner source updates replace old sensitive fields and deleted sources cannot be resurrected',async()=>{
 const source=db.doc('orders/projection-integration');const view=db.doc('partnerOrderViews/projection-integration');
 await source.set({Restaurant:{ownerId:'partner'},Receiver:{id:'private-id',name:'Name',email:'private-email'},Amount:100});
 await view.set({Receiver:{email:'old-private-email'},stripeSessionId:'old-secret'});await syncPartnerOrderView(source.id);
 let data=(await view.get()).data();assert.equal(data.Receiver.email,undefined);assert.equal(data.Receiver.id,undefined);assert.equal(data.stripeSessionId,undefined);assert.equal(data.Amount,100);
 await source.update({Amount:120,currentStatus:'Preparing'});await syncPartnerOrderView(source.id);data=(await view.get()).data();assert.equal(data.Amount,120);assert.equal(data.currentStatus,'Preparing');
 await source.delete();await syncPartnerOrderView(source.id);assert.equal((await view.get()).exists,false);
});
test('backfill preview does not write; mutation requires a recently authenticated food master',async()=>{
 const id='backfill-integration';await db.doc(`orders/${id}`).set({Restaurant:{ownerId:'partner'},Receiver:{email:'secret'},Amount:50});
 const caller={uid:'fixture-master',role:'masterAdmin',token:{auth_time:Math.ceil(Date.now()/1000)}};
 await backfillPartnerOrderViews(caller,{dryRun:true});assert.equal((await db.doc(`partnerOrderViews/${id}`).get()).exists,false);
 await assert.rejects(backfillPartnerOrderViews({...caller,role:'restaurantOwner'},{dryRun:false}),e=>e.code==='permission-denied');
 await assert.rejects(backfillPartnerOrderViews({...caller,token:{}},{dryRun:false}),e=>e.code==='failed-precondition');
 await backfillPartnerOrderViews(caller,{dryRun:false});assert.equal((await db.doc(`partnerOrderViews/${id}`).get()).data().Receiver.email,undefined);
});
after(async()=>{await deleteApp(app);});
