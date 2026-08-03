// Type declarations for CSS module imports
declare module "*.css" {
  const styles: { [className: string]: string };
  export default styles;
}
