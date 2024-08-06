import { getAccountInfoByToken } from '@hcengineering/account'
import { BrandingMap, concatLink, MeasureContext } from '@hcengineering/core'
import Router from 'koa-router'
import { Db } from 'mongodb'
import { Strategy as CustomStrategy } from 'passport-custom'
import { Passport } from '.'
import { getBranding, getHost, safeParseAuthState } from './utils'

export function registerToken (
  measureCtx: MeasureContext,
  passport: Passport,
  router: Router<any, any>,
  accountsUrl: string,
  db: Db,
  productId: string,
  frontUrl: string,
  brandings: BrandingMap
): string | undefined {
  passport.use(
    'token',
    new CustomStrategy(function (req: any, done: any) {
      const token = req.body.token ?? req.query.token

      getAccountInfoByToken(measureCtx, db, productId, null, token)
        .then((user: any) => done(null, user))
        .catch((err: any) => done(err))
    })
  )

  router.get(
    '/auth/token',
    async (ctx, next) => {
      measureCtx.info('try auth via', { provider: 'token' })
      const host = getHost(ctx.request.headers)
      const branding = host !== undefined ? brandings[host]?.key ?? undefined : undefined
      const state = encodeURIComponent(
        JSON.stringify({
          inviteId: ctx.query?.inviteId,
          branding
        })
      )

      await passport.authenticate('token', { session: true, state })(ctx, next)
    },
    async (ctx, next) => {
      measureCtx.info('Provider auth success', { type: 'token', user: ctx.state?.user })
      const user = ctx.state.user
      if (user !== undefined) {
        const state = safeParseAuthState(ctx.query?.state)
        const branding = getBranding(brandings, state?.branding)

        if (ctx.session != null) {
          ctx.session.loginInfo = user
        }

        measureCtx.info('Success auth, redirect', { email: user.email, type: 'token' })
        // Successful authentication, redirect to your application
        ctx.redirect(concatLink(branding?.front ?? frontUrl, '/onboard/auth'))
      }
      await next()
    }
  )

  return 'token'
}
