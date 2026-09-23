export const delay = (ms: number = 50) =>
  new Promise((resolve) => setTimeout(resolve, ms));