export type AiPublicError = {
  success: false;
  code: string;
  message: string;
};

export function aiError(code: string, message: string): AiPublicError {
  return { success: false, code, message };
}
