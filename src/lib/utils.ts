import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard utility helper to safely merge Tailwind CSS class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
