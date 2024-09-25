import type { Orders } from '#cds-models/ServiceAccruals';
import type { MiddlewareImpl, NextMiddleware, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';

export class MiddlewareMethodAfterRead1 implements MiddlewareImpl {
  public async use(req: TypedRequest<Orders>, next: NextMiddleware): Promise<void> {
    console.log('Middleware 1: @AfterRead');
    await next();
  }
}
