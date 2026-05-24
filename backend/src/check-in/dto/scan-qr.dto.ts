import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ScanQrDto {
  @IsNotEmpty()
  @IsString()
  qrCode: string;

  @IsOptional()
  @IsString()
  centerId?: string;
}
