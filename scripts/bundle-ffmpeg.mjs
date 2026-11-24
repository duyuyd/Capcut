import {mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
const base=path.resolve('node_modules/@ffmpeg/core/dist/umd');
const dest=path.resolve('public/ffmpeg');
await mkdir(dest,{recursive:true});
for(const name of ['ffmpeg-core.js','ffmpeg-core.wasm']){
 await copyFile(path.join(base,name),path.join(dest,name));
 process.stdout.write('Bundled '+name+' locally\n');
}
