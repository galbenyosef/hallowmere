import {networkInterfaces} from 'node:os';
import {createGameServer} from '../server/server.mjs';
const network=process.argv.includes('--network'),production=process.env.NODE_ENV==='production';
const origins=(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
if(production&&!origins.length)throw Error('Set ALLOWED_ORIGINS to the public game origin before starting production.');
const port=Number(process.env.PORT||5182),host=network||production?'0.0.0.0':'127.0.0.1';
const game=createGameServer({origins});
game.server.listen(port,host,()=>{
 console.log(`Local: http://127.0.0.1:${port}`);
 if(network)for(const addresses of Object.values(networkInterfaces()))for(const a of addresses||[])if(a.family==='IPv4'&&!a.internal)console.log(`Network: http://${a.address}:${port}`);
});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{await game.close();process.exit(0);});
