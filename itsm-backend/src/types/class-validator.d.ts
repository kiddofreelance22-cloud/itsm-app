declare module 'class-validator' {
  export function ArrayMaxSize(...args: any[]): PropertyDecorator;
  export function IsArray(...args: any[]): PropertyDecorator;
  export function IsBoolean(...args: any[]): PropertyDecorator;
  export function IsDateString(...args: any[]): PropertyDecorator;
  export function IsEmail(...args: any[]): PropertyDecorator;
  export function IsIn(...args: any[]): PropertyDecorator;
  export function IsInt(...args: any[]): PropertyDecorator;
  export function IsNotEmpty(...args: any[]): PropertyDecorator;
  export function IsNumber(...args: any[]): PropertyDecorator;
  export function IsObject(...args: any[]): PropertyDecorator;
  export function IsOptional(...args: any[]): PropertyDecorator;
  export function IsPositive(...args: any[]): PropertyDecorator;
  export function IsString(...args: any[]): PropertyDecorator;
  export function Matches(...args: any[]): PropertyDecorator;
  export function Max(...args: any[]): PropertyDecorator;
  export function MaxLength(...args: any[]): PropertyDecorator;
  export function Min(...args: any[]): PropertyDecorator;
  export function MinLength(...args: any[]): PropertyDecorator;
  export function ValidateNested(...args: any[]): PropertyDecorator;
}
