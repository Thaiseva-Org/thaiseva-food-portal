const {test}=require('node:test');const assert=require('node:assert/strict');
const {partnerOrderView}=require('../functions/src/lib/partnerOrderViews');
test('partner view preserves order fulfilment and locked finance but excludes customer identity and payment secrets',()=>{
 const order={orderId:'o',Receiver:{id:'PRIVATE_ID',email:'PRIVATE_EMAIL',name:'Name',phoneNumber:'000',address:'Address',password:'PRIVATE_PASSWORD'},CustomerEmail:'PRIVATE_EMAIL',CustomerId:'PRIVATE_ID',stripeSessionId:'PRIVATE_PAYMENT',Restaurant:{ownerId:'restaurant',name:'Restaurant'},Items:[{name:'Dish',price:100,quantity:2}],Amount:220,deliveryCharge:20,Status:[{status:'Delivered',timestamp:new Date(),by:'PRIVATE_ID'}],accounting:{amount:220,commissionPct:10,commissionBase:200,deliveryCharge:20,adminShare:40,partnerShare:180,secret:'PRIVATE_PAYMENT'}};
 const view=partnerOrderView(order);assert.doesNotMatch(JSON.stringify(view),/PRIVATE_/);
 assert.equal(view.Receiver.name,'Name');assert.equal(view.Receiver.phoneNumber,'000');assert.equal(view.Receiver.address,'Address');assert.equal(view.Items[0].quantity,2);
 assert.equal(view.Amount,220);assert.equal(view.accounting.partnerShare,180);assert.equal(view.Restaurant.ownerId,'restaurant');assert.equal(view.Status[0].status,'Delivered');
});
test('legacy alternate items retain invoice totals and dietary labels when the primary array is empty',()=>{
 const view=partnerOrderView({Items:[],items:[{name:'Dish',price:100,quantity:2,discount:10,lineAmount:180,total:180,Label:'Vegetarian'}],Amount:180});
 assert.equal(view.Items.length,1);assert.equal(view.Items[0].lineAmount,180);assert.equal(view.Items[0].total,180);assert.equal(view.Items[0].Label,'Vegetarian');
});
