#!/usr/bin/env node

const fs=require("fs");
const path=require("path");
const root=path.resolve(__dirname,"..");
const failures=[];
let passed=0;

function read(relative){
  const file=path.join(root,relative);
  if(!fs.existsSync(file)){
    failures.push(`${relative}: file is missing`);
    return "";
  }
  return fs.readFileSync(file,"utf8");
}

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

function requireText(relative,text){
  check(read(relative).includes(text),`${relative}: missing ${JSON.stringify(text)}`);
}

const dedupeFile="supabase/migrations/20260802212000_fix_linkup_notification_dedupe.sql";
check(fs.existsSync(path.join(root,dedupeFile)),`${dedupeFile}: migration is missing`);

const checkin=read("app/checkins/create.js");
check(checkin.includes("toFixed(2)"),"Check-in UI must round location to two decimals");
check(checkin.includes("Broad area"),"Check-in UI must request a broad area");
check(checkin.includes("not a street or private address"),"Check-in UI must warn against private addresses");
check(!checkin.includes("setArea(place.address||place.location||area)"),"Selecting a listing must not copy its street address into the public area field");
check(checkin.includes('activity==="Other"?customActivity.trim():activity.trim()'),"Custom activity regression protection is missing");

const live=read("app/live.js");
for(const contract of [
  "areaDraft",
  "areaFilter",
  "function applyArea()",
  "onSubmitEditing={applyArea}",
  "onPress={applyArea}",
  "toFixed(2)"
]) check(live.includes(contract),`app/live.js: missing ${contract}`);
check(!live.includes("[area,latitude,longitude,radius,windowHours]"),"Live Nearby must not reload on each area keystroke");

const hardening=read("supabase/migrations/20260802211800_harden_linkups_live_privacy.sql").toLowerCase();
for(const contract of [
  "create schema if not exists private",
  "private.can_view_linkup",
  "not private.linkup_users_blocked",
  "round(v_latitude::numeric,2)",
  "round(v_longitude::numeric,2)",
  "security invoker",
  "business not found",
  "activity club not found",
  "event not found",
  "daily report limit",
  "you cannot report your own content or profile",
  "status=case when a.user_id=v_user then 'left' else 'removed' end"
]) check(hardening.includes(contract),`Privacy migration missing ${contract}`);

const performance=read("supabase/migrations/20260802211900_linkups_live_performance.sql").toLowerCase();
check(performance.includes("linkup_messages_user_created_idx"),"Message-author performance index missing");
check(performance.includes("'reminders',0"),"Non-Explorer reminder no-op missing");

const dedupe=read(dedupeFile).toLowerCase();
for(const type of ["linkup-joined-","linkup-left-","linkup-full-","linkup-updated-","linkup-removed-"]){
  const start=dedupe.indexOf(type);
  check(start>=0,`Dedupe migration missing ${type}`);
  if(start>=0) check(dedupe.slice(start,start+240).includes("gen_random_uuid()"),`${type} must use a unique event suffix`);
}

requireText("package.json",'"verify:live"');
requireText(".github/workflows/quality-checks.yml","Verify Link-ups and Live Discovery");

if(failures.length){
  console.error(`Link-up hardening gate FAILED (${failures.length} issue${failures.length===1?"":"s"}).`);
  for(const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Link-up hardening gate passed (${passed} checks).`);
