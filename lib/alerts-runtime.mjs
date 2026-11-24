import {get,put,BlobPreconditionFailedError} from "@vercel/blob";
import {generateRequestDetails} from "web-push";
import {validateSubscription,verifySnapshot} from "./alerts-core.mjs";
const BLOB_PATH="campus-alerts/pilot-v1.json";
const DATA="https://raw.githubusercontent.com/mykcs/campus-agent-data/main/data/";
const MAX_STORE_BYTES=900000, MAX_DATA_BYTES=4000000;
async function jsonStream(stream,max){
  if(!stream)throw Error("stream-unavailable");
  const reader=stream.getReader();let total=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw Error("size-limit");}chunks.push(Buffer.from(value));}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks,total).toString("utf8"));
}
export function privateStore(config,{readBlob=get,writeBlob=put}={}){
  // Explicit private access is required, even for the initial write.
  const options={access:"private",token:config.blobToken};
  return {
    async read(){
      const result=await readBlob(BLOB_PATH,{...options,headers:{"Cache-Control":"no-cache"},abortSignal:AbortSignal.timeout(6000)});
      if(!result)return {etag:null,state:{version:1,leaseUntil:0,devices:{}}};
      if(result.statusCode!==200||!result.blob?.etag||!result.blob?.url||!new URL(result.blob.url).hostname.endsWith(".private.blob.vercel-storage.com"))throw Error("private-store-read");
      return {etag:result.blob.etag,state:await jsonStream(result.stream,MAX_STORE_BYTES)};
    },
    async write(etag,state){
      const text=JSON.stringify(state);
      if(Buffer.byteLength(text)>MAX_STORE_BYTES)throw Error("private-store-capacity");
      try{
        const blob=await writeBlob(BLOB_PATH,text,{...options,addRandomSuffix:false,contentType:"application/json",cacheControlMaxAge:60,allowOverwrite:etag!==null,...(etag!==null?{ifMatch:etag}:{}),abortSignal:AbortSignal.timeout(6000)});
        if(!blob?.etag||!new URL(blob.url).hostname.endsWith(".private.blob.vercel-storage.com"))throw Error("private-store-write");
        return {etag:blob.etag};
      }catch(error){
        if(error instanceof BlobPreconditionFailedError)throw Object.assign(Error("compare-and-swap-conflict"),{status:409});
        throw error;
      }
    }
  };
}
export async function loadPublicSnapshot(fetcher=fetch,clock=Date.now){
  const load=async(name)=>{
    const response=await fetcher(DATA+name,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(6000)});
    if(!response.ok)throw Error("public-data-unavailable");
    return jsonStream(response.body,MAX_DATA_BYTES);
  };
  const [snapshot,history]=await Promise.all([load("notices.json"),load("health-checks.json")]);
  return verifySnapshot(snapshot,history,clock());
}
export async function encryptedPush(config,subscription,payload,fetcher=fetch){
  const sub=validateSubscription(subscription);
  if(!sub)throw Error("invalid-subscription");
  const details=generateRequestDetails(sub,JSON.stringify(payload),{
    vapidDetails:{subject:config.subject,publicKey:config.publicKey,privateKey:config.privateKey},
    TTL:300,urgency:"normal",contentEncoding:"aes128gcm"
  });
  if(details.endpoint!==sub.endpoint||details.method!=="POST")throw Error("invalid-transport");
  const response=await fetcher(details.endpoint,{method:details.method,headers:details.headers,body:details.body,redirect:"error",signal:AbortSignal.timeout(5000)});
  // Discard provider response body; never echo its error details.
  try{await response.body?.cancel();}catch{}
  return response.status;
}
