export const delay = (ms: number = 50) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};