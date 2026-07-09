declare global {
  namespace Express {
    interface Request {
      auth: {
        userId: number;
        supabaseUserId: string;
        email: string | null;
      };
    }
  }
}

export {};
