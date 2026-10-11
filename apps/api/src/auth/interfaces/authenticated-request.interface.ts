import { Request } from 'express';

import { SafeUser } from './safe-user.interface';

export interface AuthenticatedRequest extends Request {
  user: SafeUser;
}
