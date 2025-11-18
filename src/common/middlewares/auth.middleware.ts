// src/middleware/auth.middleware.ts
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { jwtDecode } from 'jwt-decode';
import { PrismaService } from '../../prisma.service';

// Extend the Request interface to include mw_userid
declare module 'express-serve-static-core' {
  interface Request {
    mw_userid?: number | string;
  }
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];

    // Check if auth header is present if not then skip the middleware
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    if (req.headers.authorization) {
      let bearerToken: string = '';
      let bearerTokenParts: string[] = [];

      // Get userid from  auth/login jwt token
      const authToken = req?.headers?.authorization;
      const authTokenTemp = req?.headers?.authorization.split(' ');

      // If Bearer word not found in auth header value
      if (authTokenTemp[0] !== 'Bearer') {
        req.mw_userid = '';
      }
      // Get trimmed Bearer token value by skipping Bearer value
      else {
        bearerToken = authHeader.split(' ')[1];
      }

      // If Bearer token value is not passed
      if (!bearerToken) {
        req.mw_userid = '';
      }
      // Lets split token by dot (.)
      else {
        bearerTokenParts = bearerToken.split('.');
      }

      // Since JWT has three parts - seperated by dots(.), lets split token
      if (bearerTokenParts.length < 3) {
        req.mw_userid = '';
      }

      try {
        const decoded: any = jwtDecode(authToken);
        let userId: string = String(decoded.id);

        // Get the middleware user id from the strapi user id
        const user = await this.prisma.users.findUnique({
          where: { s_id: userId },
        });

        if (!user) {
          throw new UnauthorizedException('User not found');
        }

        req.mw_userid = user.id;
        next();

      } catch (error) {
        console.error('Something went wrong:', error.message);
        req.mw_userid = '';
        next(new UnauthorizedException('Invalid token'));
      }
    }

  }
}
