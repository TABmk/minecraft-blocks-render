import "../app.css";

export const ssr = false;
export const prerender = true;
export const trailingSlash = 'always';

// custom window properties
// declare global {
//   interface Window {
//     goal: (name: string) => void;
//   }
// }