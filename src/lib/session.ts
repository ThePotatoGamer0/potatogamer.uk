const KEY = "pg-admin-password";
export const GUEST_NAME_KEY = "pg-guestbook-user";

export function readAdminPassword(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeAdminPassword(password: string): void {
  sessionStorage.setItem(KEY, password);
}

export function clearAdminPassword(): void {
  sessionStorage.removeItem(KEY);
}

export function readGuestName(): string {
  try {
    return localStorage.getItem(GUEST_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeGuestName(username: string): void {
  localStorage.setItem(GUEST_NAME_KEY, username);
}
