import type { MiddlewareImpl, NextMiddleware, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import type { Orders } from '../../@cds-models/ServiceAccruals';

export class MiddlewareOrders implements MiddlewareImpl {
  public async use(req: TypedRequest<Orders>, next: NextMiddleware): Promise<void> {
    console.log('Middleware entity 1 : EXECUTED');
    await next();
  }
}
