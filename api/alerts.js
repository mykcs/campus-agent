import {makeHandler,readConfig} from "../lib/alerts-core.mjs";
import {privateStore,loadPublicSnapshot,encryptedPush} from "../lib/alerts-runtime.mjs";
// No secrets or store are created by deploying. Disabled unless every pilot
// variable is explicitly configured in the approved environment.
export default async function handler(req,res){
  const config=readConfig(process.env);
  const handle=makeHandler({config,store:config?privateStore(config):null,
    loadSnapshot:()=>loadPublicSnapshot(),send:(sub,payload)=>encryptedPush(config,sub,payload)});
  return handle(req,res);
}
