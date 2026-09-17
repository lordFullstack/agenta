// src/validate-params.middleware.ts
import { Request, Response, NextFunction } from "express";
import { isValidUuid } from "./validation";

export function validateUuidParams(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (!isValidUuid(value)) {
        return res.status(400).json({ error: "invalid_param", message: `${name} debe ser un identificador válido.` });
      }
    }
    next();
  };
}
