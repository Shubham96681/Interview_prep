/**
 * Avatar utility functions
 * Provides default avatars and avatar generation
 */

import defaultAvatarSvg from '@/assets/avatars/default-avatar.svg?url';

// Default avatar URLs - using UI Avatars service for dynamic avatars
export const getDefaultAvatar = (name: string, size: number = 200): string => {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  // Using UI Avatars API for nice default avatars
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=${size}&background=2563eb&color=ffffff&bold=true&font-size=0.5`;
};

// Alternative: Use DiceBear API for more variety
export const getDiceBearAvatar = (name: string, style: string = 'avataaars'): string => {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3ff,c0aede,ffd5dc,ffdfbf`;
};

// Fallback avatar (local SVG)
export const getFallbackAvatar = (): string => {
  return defaultAvatarSvg;
};

// Generate avatar URL with fallback chain
// Handles:
// 1. Full URLs (http/https) - use as-is
// 2. Relative paths starting with /uploads - prepend backend URL
// 3. Empty/undefined - generate from name or use fallback
export const getAvatarUrl = (avatar?: string, name?: string): string => {
  // If avatar is provided and is a full URL, use it
  if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
    return avatar;
  }
  
  // If avatar is provided and is a relative path (e.g., /uploads/...), prepend backend URL
  if (avatar && avatar.startsWith('/uploads')) {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return `${backendUrl}${avatar}`;
  }
  
  // If avatar is provided but doesn't match above patterns, try to use it
  if (avatar) {
    return avatar;
  }
  
  // If no avatar but we have a name, generate one from initials
  if (name) {
    return getDefaultAvatar(name);
  }
  
  // Final fallback to default SVG
  return getFallbackAvatar();
};

