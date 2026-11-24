import type { NextFunction, Response } from 'express';
import type { FileHandle } from 'node:fs/promises';

export const streamFileHandle = (
  file: FileHandle,
  res: Response,
  next: NextFunction,
): void => {
  const stream = file.createReadStream({ autoClose: true });
  res.once('close', () => {
    if (!stream.destroyed) stream.destroy();
  });
  stream.once('error', (error: Error) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    next(error);
  });
  stream.pipe(res);
};
