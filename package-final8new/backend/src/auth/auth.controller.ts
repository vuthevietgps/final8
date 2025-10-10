import { Controller, Post, Body, UseGuards, Request, Get, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    // Lấy IP từ request (x-forwarded-for khi qua proxy, fallback remoteAddress)
    const forwarded = (req.headers['x-forwarded-for'] as string) || '';
    // Lấy tất cả IP từ x-forwarded-for (format: ip1,ip2,ip3)
    const forwardedIps = forwarded ? forwarded.split(',').map(ip => ip.trim()).filter(ip => ip) : [];
    const clientIp = forwardedIps[0] || req.ip || req.socket?.remoteAddress || '';
    
    // Truyền tất cả IP có thể để AuthService kiểm tra
    return this.authService.login(loginDto, clientIp, forwardedIps);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('validate-token')
  async validateToken(@Request() req) {
    // Trả về thông tin user nếu token hợp lệ
    return {
      valid: true,
      user: req.user,
    };
  }
}
