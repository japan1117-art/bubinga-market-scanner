import test from "node:test";
import assert from "node:assert/strict";
import {crossWatch} from "../src/lib/live-scan.ts";

test("both watches distinguish proximity from a directional approach",()=>{
  for(const dir of ["BULL","BEAR"] as const){
    const v=(x:number)=>dir==="BULL"?x:100-x;
    const watch=(k:number,d:number,pk:number,pd:number,r:number)=>crossWatch(dir,v(k),v(d),v(pk),v(pd),v(r));
    assert.equal(watch(0,3.16,0,4,43.48)?.approaching,false);
    assert.equal(watch(10,15,8,14,48)?.approaching,true);
    assert.equal(watch(10,10,8,14,48),null);
    assert.equal(watch(8,14,7,15,48),null);
    assert.equal(watch(8,10,7,15,49),null);
  }
});
