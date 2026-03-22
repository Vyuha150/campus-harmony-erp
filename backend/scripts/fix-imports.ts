import fs from 'fs';
import path from 'path';

function fixImportsInDirectory(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fixImportsInDirectory(filePath);
    } else if (file.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Fix "import { Request, Response } from 'express'" -> "import type { Request, Response } from 'express'"
      content = content.replace(/import { (?:Request, Response|Response, Request) } from 'express';/g, "import type { Request, Response } from 'express';\nimport { Router } from 'express';");
      content = content.replace(/import { Router, Request, Response } from 'express';/g, "import type { Request, Response } from 'express';\nimport { Router } from 'express';");
      
      // Fix relative imports: from '../server' -> from '../server.js'
      content = content.replace(/from '\.\.\/server';/g, "from '../server.js';");
      
      // Fix relative imports in server.ts
      if (file === 'server.ts') {
        content = content.replace(/from '\.\/routes\/([a-zA-Z0-9_-]+)';/g, "from './routes/$1.js';");
        // Also fix the express types
        content = content.replace(/req: Request, res: Response/g, 'req: express.Request, res: express.Response');
      }

      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

fixImportsInDirectory(path.join(__dirname, '../src'));
fixImportsInDirectory(path.join(__dirname, '../prisma'));
console.log('Fixed imports!');
