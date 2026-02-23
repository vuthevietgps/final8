import { SetMetadata } from '@nestjs/common';

/**
 * Decorator để set roles cho endpoint
 * @example @Roles('director', 'manager')
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
