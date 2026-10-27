const assert = require("node:assert/strict");
const {test} = require("node:test");
require("reflect-metadata");
const {plainToInstance} = require("class-transformer");
const {validate} = require("class-validator");
const {VelasService} = require("../dist/velas/velas.service.js");
const {VelaListQueryDto} = require("../dist/velas/vela.dto.js");

function serviceFor(documents) {
  const state = {filters:[], sorts:[], skips:[], limits:[]};
  const matching = (filter) => documents.filter(c => {
    if (filter.startedAt?.$gt) return c.startedAt > filter.startedAt.$gt;
    if (filter.startedAt?.$lte) return c.startedAt <= filter.startedAt.$lte;
    return true;
  });
  const model = {
    find(filter) {
      state.filters.push(filter);
      let skip=0, limit=60;
      return {
        sort(value) {state.sorts.push(value); return this;},
        skip(value) {skip=value; state.skips.push(value); return this;},
        limit(value) {limit=value; state.limits.push(value); return this;},
        exec:async()=>matching(filter).sort((a,b)=>b.startedAt-a.startedAt || b.reference.localeCompare(a.reference)).slice(skip,skip+limit),
      };
    },
    countDocuments(filter) { return {exec:async()=>matching(filter).length}; },
  };
  return {service:new VelasService(model,{}), state};
}

const fixedNow=Date.parse("2026-10-25T03:00:00Z");
const candle=(id,startedAt)=>({
  reference:"V-"+String(id).padStart(24,"0"),intention:"Calma",dedication:"",name:"",
  color:"azul",startedAt:new Date(startedAt),publishLocation:false,countryCode:"CL",cityName:"Santiago",
});

test("active candles are paginated in newest-first groups of twenty without duplicates",async(t)=>{
  t.mock.method(Date,"now",()=>fixedNow);
  const documents=Array.from({length:41},(_,i)=>candle(i,fixedNow-(i+1)*60000)).reverse();
  const {service,state}=serviceFor(documents);
  const first=await service.list({status:"active",limit:20,skip:0});
  const second=await service.list({status:"active",limit:20,skip:20});
  const last=await service.list({status:"active",limit:20,skip:40});
  assert.deepEqual([first.candles.length,second.candles.length,last.candles.length],[20,20,1]);
  assert.deepEqual(first.pagination,{total:41,limit:20,skip:0,hasMore:true});
  assert.deepEqual(last.pagination,{total:41,limit:20,skip:40,hasMore:false});
  const ids=[...first.candles,...second.candles,...last.candles].map(c=>c.id);
  assert.equal(new Set(ids).size,41);
  assert.equal(ids[0],candle(0,fixedNow).reference);
  assert.equal(ids[40],candle(40,fixedNow).reference);
  assert.ok(state.filters.every(filter=>filter.startedAt.$gt.getTime()===fixedNow-48*3600000));
  assert.ok(state.sorts.every(sort=>sort.startedAt===-1&&sort.reference===-1));
});

test("the 48-hour boundary belongs only to extinguished candles and keeps their color and privacy",async(t)=>{
  t.mock.method(Date,"now",()=>fixedNow);
  const cutoff=fixedNow-48*3600000;
  const {service}=serviceFor([candle(1,cutoff+1),candle(2,cutoff),candle(3,cutoff-1)]);
  const active=await service.list({status:"active",limit:20,skip:0});
  const out=await service.list({status:"extinguished",limit:20,skip:0});
  assert.equal(active.pagination.total,1);
  assert.equal(out.pagination.total,2);
  assert.equal(out.candles[0].id,candle(2,cutoff).reference);
  assert.ok(out.candles.every(c=>c.color==="azul"&&!Object.hasOwn(c,"countryCode")&&!Object.hasOwn(c,"cityName")));
});

test("legacy unfiltered listing stays compatible and empty pages report their total",async(t)=>{
  t.mock.method(Date,"now",()=>fixedNow);
  const {service}=serviceFor([candle(1,fixedNow-60000)]);
  const legacy=await service.list({limit:60,skip:0});
  assert.deepEqual(Object.keys(legacy),["candles"]);
  const out=await service.list({status:"extinguished",limit:20,skip:0});
  assert.deepEqual(out,{candles:[],pagination:{total:0,limit:20,skip:0,hasMore:false}});
});

test("list query validates statuses and pagination bounds",async()=>{
  const valid=plainToInstance(VelaListQueryDto,{status:"active",limit:"20",skip:"20"});
  assert.equal((await validate(valid)).length,0);
  assert.equal(valid.limit,20);
  assert.equal(valid.skip,20);
  for(const input of [{status:"unknown"},{limit:"0"},{limit:"101"},{skip:"-1"},{skip:"1.5"}]){
    assert.ok((await validate(plainToInstance(VelaListQueryDto,input))).length>0);
  }
});
