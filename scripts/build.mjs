import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist');
// Only the generated directory directly inside this project may be replaced.
if(path.dirname(output)!==root||path.basename(output)!=='dist')throw new Error('Invalid build output path');
await fs.rm(output,{recursive:true,force:true});

const files=[
  'index.html',
  ...['app.js','art.js','data.js','engine.js','icons.js','storage.js','style.css','ui-utils.js'].map(name=>`src/${name}`),
  'assets/favicon.svg','assets/LUCIDE-LICENSE',
];
for(const file of files){
  const target=path.join(output,file);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.copyFile(path.join(root,file),target);
}
await fs.writeFile(path.join(output,'.nojekyll'),'');
console.log(`Built ${files.length+1} public files in dist/`);
