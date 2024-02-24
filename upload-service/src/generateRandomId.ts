const MAX_LEN = 5;
const SUBSET = '1234567890qwertyuiopasdfghjklzxcvbnm';
const SUBSET_LENGTH = SUBSET.length;

export const generateId = (): string => {
  return Array.from({ length: MAX_LEN }, () =>
    SUBSET.charAt(Math.floor(Math.random() * SUBSET_LENGTH)),
  ).join('');
};
