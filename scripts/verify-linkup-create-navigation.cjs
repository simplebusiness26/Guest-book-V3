#!/usr/bin/env node

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const failures=[];

function read(relative){
  const file=path.join(root,relative);
  if(!fs.existsSync(file)){
    failures.push(`${relative} is missing`);
    return "";
  }
  return fs.readFileSync(file,"utf8");
}

const index=read("app/linkups/index.js");
const create=read("app/linkups/create.js");
const layout=read("app/_layout.js");

const checks=[
  [index.includes('import {Link,router,useFocusEffect} from "expo-router"'),"Link-ups screen must import Expo Router Link"],
  [index.includes('<Link href="/linkups/create" asChild>'),"Create Link-up must use a real /linkups/create Link"],
  [index.includes('testID="create-linkup-button"'),"Create Link-up control must retain its regression test identifier"],
  [!index.includes('onPress={()=>router.push("/linkups/create")}'),"Create Link-up must not fall back to the broken press-only navigation"],
  [create.includes("export default function CreateLinkup"),"Create Link-up route component is missing"],
  [create.includes('rpc("create_linkup"'),"Create Link-up route is not connected to the create_linkup RPC"],
  [layout.includes('name="linkups/create"'),"Root router does not register linkups/create"]
];

for(const [condition,message] of checks){
  if(!condition) failures.push(message);
}

if(failures.length){
  console.error(`Link-up create navigation check FAILED (${failures.length} issue${failures.length===1?"":"s"}).`);
  for(const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Link-up create navigation check passed (${checks.length} checks).`);
