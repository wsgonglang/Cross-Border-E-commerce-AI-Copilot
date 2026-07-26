import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class LoginDto {
  @IsEmail()
  @MaxLength(191)
  email!: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string
}
