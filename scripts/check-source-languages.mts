import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(file=>file&&existsSync(file)&&/\.(?:js|jsx|mjs|cjs)$/.test(file));
if(files.length)throw Error('Authored JavaScript sources must be converted to TypeScript: '+files.join(', '));
console.log('No authored JavaScript sources remain. Browser JavaScript is generated from TypeScript.');
