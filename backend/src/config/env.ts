export type AppEnv = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  FRONTEND_URL: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
};

const parsePort = (value: string | undefined): number => {
  const parsed = Number(value ?? '4000');
  return Number.isNaN(parsed) ? 4000 : parsed;
};

export const env: AppEnv = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parsePort(process.env.PORT),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
};
