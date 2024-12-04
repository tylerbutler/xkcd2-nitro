import { defineEventHandler } from "h3";

export default defineEventHandler(() => {
  const html = renderSSR(() => <h1>Nitro + nano-jsx works!</h1>);
  return html;
});