// api/index.ts
//
// Handler serverless de Vercel: reexporta la misma app de Express que usa el servidor
// local (`src/index.ts`), sin `listen()`. Vercel enruta todo tráfico acá vía vercel.json.
import { app } from "../src/app";

export default app;
