import type { NextConfig } from 'next';
const config:NextConfig={output:'export',images:{unoptimized:true},reactStrictMode:true,webpack(c){c.experiments={...c.experiments,asyncWebAssembly:true};return c}};
export default config;