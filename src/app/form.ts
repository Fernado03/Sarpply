export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function failure(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong.';
}
